import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

import type { WidgetValue } from "./widget";
import { createDeferred, createWidgetTestEnvironment, flushMicrotasks } from "./test-helpers";

function renderWidgetValue(
  instance: { renderValue: (x: { spec: Record<string, unknown> }) => void },
  value: WidgetValue
): void {
  (instance.renderValue as (x: WidgetValue) => void)(value);
}

test("loads widget tests from TypeScript sources without requiring the built bundle", async () => {
  const bundlePath = path.join(process.cwd(), "inst", "htmlwidgets", "ggsql_vega.js");
  const backupPath = `${bundlePath}.bak`;

  await fs.rename(bundlePath, backupPath);

  try {
    const env = await createWidgetTestEnvironment();
    env.setEmbed((container, spec) =>
      Promise.resolve({
        view: { spec, finalize: () => {} }
      })
    );

    const w = env.createInstance(450, 400);
    renderWidgetValue(w.instance, { spec: { mark: "point" } });
    await flushMicrotasks();
  } finally {
    await fs.rename(backupPath, bundlePath);
  }
});

test("keeps the layout height while rendering an opt-in scaled simple spec", async () => {
  const env = createWidgetTestEnvironment();
  env.setEmbed((container, spec) => {
    container.scrollHeight = 200;
    return Promise.resolve({
      view: { spec, finalize: () => {} }
    });
  });

  const w = env.createInstance(225); // < 450 = scaled
  w.el.style.height = "400px";

  renderWidgetValue(w.instance, { spec: { name: "first" }, min_width: 450 });
  await flushMicrotasks();
  assert.equal(w.el.style.height, "400px");

  renderWidgetValue(w.instance, { spec: { name: "second" }, min_width: 450 });
  await flushMicrotasks();
  assert.equal(w.el.style.height, "400px");

  w.el.clientWidth = 450;
  w.instance.resize(450, 400);
  await flushMicrotasks();
  assert.equal(w.el.style.height, "400px");
});

test("ignores superseded async embed results", async () => {
  const env = createWidgetTestEnvironment();
  const first = createDeferred<{ view: { id: string; finalized: boolean; finalize: () => void } }>();
  const second = createDeferred<{ view: { id: string; finalized: boolean; finalize: () => void } }>();
  const calls: Array<{ container: unknown; spec: Record<string, unknown> }> = [];

  env.setEmbed((container, spec) => {
    calls.push({ container, spec });
    if (calls.length === 1) return first.promise;
    return second.promise;
  });

  const w = env.createInstance(450);

  renderWidgetValue(w.instance, { spec: { name: "first" } });
  renderWidgetValue(w.instance, { spec: { name: "second" } });

  const staleView = { id: "stale", finalized: false, finalize() { this.finalized = true; } };
  const latestView = { id: "latest", finalized: false, finalize() { this.finalized = true; } };

  second.resolve({ view: latestView });
  await flushMicrotasks();

  first.resolve({ view: staleView });
  await flushMicrotasks();

  assert.equal(staleView.finalized, true);
  assert.equal(latestView.finalized, false);
});

test("finalizes view when widget element is disconnected", async () => {
  const env = createWidgetTestEnvironment();
  let finalized = false;

  env.setEmbed((container, spec) =>
    Promise.resolve({
      view: {
        spec,
        finalize: () => {
          finalized = true;
        }
      }
    })
  );

  const w = env.createInstance(450);
  renderWidgetValue(w.instance, { spec: { name: "first" } });
  await flushMicrotasks();

  w.el.remove();

  assert.equal(finalized, true);
});

test("finalizes stale deferred embeds after disconnect", async () => {
  const env = createWidgetTestEnvironment();
  const deferred = createDeferred<{ view: { finalized: boolean; finalize: () => void } }>();
  const staleView = {
    finalized: false,
    finalize() {
      this.finalized = true;
    }
  };

  env.setEmbed(() => deferred.promise);

  const w = env.createInstance(450);
  renderWidgetValue(w.instance, { spec: { name: "first" } });

  w.el.remove();
  deferred.resolve({ view: staleView });
  await flushMicrotasks();

  assert.equal(staleView.finalized, true);
  assert.equal(w.el._view, null);
  assert.equal(w.el._vegaContainer, null);
  assert.equal(w.el._scaleWrapper, null);
});

test("rerenders compound specs after moderate width changes", async () => {
  const env = createWidgetTestEnvironment();
  const calls: Array<Record<string, unknown>> = [];

  env.setEmbed((container, spec) => {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    });
  });

  const w = env.createInstance(900);
  w.el.clientHeight = 400;

  renderWidgetValue(w.instance, {
    spec: {
      hconcat: [{ mark: "point" }, { mark: "bar" }]
    }
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1);
  assert.equal((calls[0].hconcat as Array<Record<string, unknown>>)[0].width, 410);

  w.el.clientWidth = 760;
  w.instance.resize(760, 400);
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal((calls[1].hconcat as Array<Record<string, unknown>>)[0].width, 340);
  assert.equal((calls[1].hconcat as Array<Record<string, unknown>>)[1].width, 340);
});

test("passes explicit dimensions and fit autosize for simple specs", async () => {
  const env = createWidgetTestEnvironment();
  const calls: Array<Record<string, unknown>> = [];

  env.setEmbed((container, spec) => {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    });
  });

  const w = env.createInstance(600, 320);

  renderWidgetValue(w.instance, {
    spec: { mark: "point" }
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].width, 600);
  assert.equal(calls[0].height, 320);
  assert.ok(calls[0].autosize);
  assert.deepEqual({ ...(calls[0].autosize as Record<string, unknown>) }, {
    type: "fit",
    contains: "padding"
  });
});

test("updates simple specs in-place on resize using the configured min_width", async () => {
  const env = createWidgetTestEnvironment();
  let embedCalls = 0;
  const widthCalls: number[] = [];
  const heightCalls: number[] = [];
  let resizeCalls = 0;
  let runAsyncCalls = 0;

  env.setEmbed((container, spec) => {
    embedCalls += 1;
    return Promise.resolve({
      view: {
        spec,
        finalize: () => {},
        width(value: number) {
          widthCalls.push(value);
          return this;
        },
        height(value: number) {
          heightCalls.push(value);
          return this;
        },
        resize() {
          resizeCalls += 1;
          return this;
        },
        runAsync() {
          runAsyncCalls += 1;
          return Promise.resolve(this);
        }
      }
    });
  });

  const w = env.createInstance(600, 320);

  renderWidgetValue(w.instance, { spec: { mark: "point" }, min_width: 450 });
  await flushMicrotasks();

  w.el.clientWidth = 300;
  w.el.clientHeight = 280;
  w.instance.resize(300, 280);
  await flushMicrotasks();

  assert.equal(embedCalls, 1);
  assert.deepEqual(widthCalls, [450]);
  assert.deepEqual(heightCalls, [280]);
  assert.equal(resizeCalls, 1);
  assert.equal(runAsyncCalls, 1);
  assert.equal(w.el._vegaContainer?.style.width, "450px");
  assert.equal(
    w.el._vegaContainer?.style.transform,
    `scale(${300 / 450})`
  );
});

test("does not mutate host height for compound specs", async () => {
  const env = createWidgetTestEnvironment();

  env.setEmbed((container, spec) => {
    container.scrollHeight = 760;
    return Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    });
  });

  const w = env.createInstance(900, 360);
  w.el.style.height = "360px";

  renderWidgetValue(w.instance, {
    spec: {
      facet: { field: "carb" },
      columns: 3,
      spec: { mark: "point" }
    }
  });
  await flushMicrotasks();

  assert.equal(w.el.style.height, "360px");
});

test("does not scale simple specs by default", async () => {
  const env = createWidgetTestEnvironment();
  const calls: Array<Record<string, unknown>> = [];

  env.setEmbed((container, spec) => {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    });
  });

  const w = env.createInstance(225, 400);
  renderWidgetValue(w.instance, { spec: { mark: "point" } });
  await flushMicrotasks();

  assert.equal(calls[0].width, 225);
  assert.equal(calls[0].height, 400);
  assert.equal(w.el._vegaContainer?.style.transform, "");
  assert.equal(w.el._vegaContainer?.style.width, "225px");
  assert.equal(w.el._vegaContainer?.style.height, "400px");
  assert.equal(w.el._scaleWrapper?.className, "ggsql-vega-scale-wrapper");
});

test("scales simple specs when min_width is provided in the payload", async () => {
  const env = createWidgetTestEnvironment();
  const calls: Array<Record<string, unknown>> = [];

  env.setEmbed((container, spec) => {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    });
  });

  const w = env.createInstance(225, 400);
  renderWidgetValue(w.instance, { spec: { mark: "point" }, min_width: 450 });
  await flushMicrotasks();

  assert.equal(calls[0].width, 450);
  assert.equal(calls[0].height, 400);
  assert.equal(w.el._vegaContainer?.style.transform, "scale(0.5)");
  assert.equal(w.el._vegaContainer?.style.width, "450px");
});

test("toggles the ggsql-scaled class for scaled renders and resize updates", async () => {
  const env = createWidgetTestEnvironment();

  env.setEmbed((container, spec) =>
    Promise.resolve({
      view: {
        spec,
        finalize: () => {},
        width() {
          return this;
        },
        height() {
          return this;
        },
        resize() {
          return this;
        },
        runAsync() {
          return Promise.resolve(this);
        }
      }
    })
  );

  const w = env.createInstance(225, 400);

  renderWidgetValue(w.instance, { spec: { mark: "point" }, min_width: 450 });
  await flushMicrotasks();

  assert.equal(w.el.classList.contains("ggsql-scaled"), true);

  w.el.clientWidth = 450;
  w.el.clientHeight = 400;
  w.instance.resize(450, 400);
  await flushMicrotasks();

  assert.equal(w.el.classList.contains("ggsql-scaled"), false);
});

test("does not add the ggsql-scaled class without scaling", async () => {
  const env = createWidgetTestEnvironment();
  const w = env.createInstance(450, 320);

  env.setEmbed((container, spec) =>
    Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    })
  );

  renderWidgetValue(w.instance, { spec: { mark: "point" } });
  await flushMicrotasks();

  assert.equal(w.el.classList.contains("ggsql-scaled"), false);
});

test("clears the ggsql-scaled class when embed fails", async () => {
  const env = createWidgetTestEnvironment();
  const w = env.createInstance(225, 400);

  env.setEmbed(() => Promise.reject(new Error("embed failed")));

  renderWidgetValue(w.instance, { spec: { mark: "point" }, min_width: 450 });
  await flushMicrotasks();

  assert.equal(w.el.textContent, "ggsql render error: Error: embed failed");
  assert.equal(w.el.classList.contains("ggsql-scaled"), false);
});

test("clears the ggsql-scaled class on finalize", async () => {
  const env = createWidgetTestEnvironment();

  env.setEmbed((container, spec) =>
    Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    })
  );

  const w = env.createInstance(225, 400);

  renderWidgetValue(w.instance, { spec: { mark: "point" }, min_width: 450 });
  await flushMicrotasks();
  assert.equal(w.el.classList.contains("ggsql-scaled"), true);

  w.el.remove();

  assert.equal(w.el.classList.contains("ggsql-scaled"), false);
});

test("renderValue refreshes viewport from host without scaling by default", async () => {
  const env = createWidgetTestEnvironment();
  const calls: Array<Record<string, unknown>> = [];

  env.setEmbed((container, spec) => {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec,
        finalize: () => {}
      }
    });
  });

  const w = env.createInstance(900, 400);
  renderWidgetValue(w.instance, { spec: { mark: "point" } });
  await flushMicrotasks();

  w.el.clientWidth = 225;
  w.el.clientHeight = 400;
  renderWidgetValue(w.instance, { spec: { mark: "point" } });
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].width, 225);
  assert.equal(calls[1].height, 400);
  assert.equal(w.el._vegaContainer?.style.transform, "");
});
