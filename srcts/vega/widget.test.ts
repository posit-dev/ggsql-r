import * as assert from "node:assert/strict";
import { test } from "node:test";

import { createDeferred, createWidgetTestEnvironment, flushMicrotasks } from "./test-helpers";

test("keeps the layout height while rendering a scaled simple spec", async () => {
  const env = createWidgetTestEnvironment();
  env.setEmbed((container, spec) => {
    container.scrollHeight = 200;
    return Promise.resolve({
      view: { spec, finalize: () => {} }
    });
  });

  const w = env.createInstance(225); // < 450 = scaled
  w.el.style.height = "400px";

  w.instance.renderValue({ spec: { name: "first" } });
  await flushMicrotasks();
  assert.equal(w.el.style.height, "400px");

  w.instance.renderValue({ spec: { name: "second" } });
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

  w.instance.renderValue({ spec: { name: "first" } });
  w.instance.renderValue({ spec: { name: "second" } });

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
  w.instance.renderValue({ spec: { name: "first" } });
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
  w.instance.renderValue({ spec: { name: "first" } });

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

  w.instance.renderValue({
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

  w.instance.renderValue({
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

test("updates simple specs in-place on resize without re-embedding", async () => {
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

  w.instance.renderValue({ spec: { mark: "point" } });
  await flushMicrotasks();

  w.el.clientWidth = 540;
  w.el.clientHeight = 280;
  w.instance.resize(540, 280);
  await flushMicrotasks();

  assert.equal(embedCalls, 1);
  assert.deepEqual(widthCalls, [540]);
  assert.deepEqual(heightCalls, [280]);
  assert.equal(resizeCalls, 1);
  assert.equal(runAsyncCalls, 1);
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

  w.instance.renderValue({
    spec: {
      facet: { field: "carb" },
      columns: 3,
      spec: { mark: "point" }
    }
  });
  await flushMicrotasks();

  assert.equal(w.el.style.height, "360px");
});

test("renders narrow widgets at logical width 450 with scale transform", async () => {
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
  w.instance.renderValue({ spec: { mark: "point" } });
  await flushMicrotasks();

  assert.equal(calls[0].width, 450);
  assert.equal(calls[0].height, 400);
  assert.equal(w.el._vegaContainer?.style.transform, "scale(0.5)");
  assert.equal(w.el._vegaContainer?.style.width, "450px");
  assert.equal(w.el._vegaContainer?.style.height, "400px");
  assert.equal(w.el._scaleWrapper?.className, "ggsql-vega-scale-wrapper");
});

test("renderValue refreshes viewport from host when the host shrinks", async () => {
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
  w.instance.renderValue({ spec: { mark: "point" } });
  await flushMicrotasks();

  w.el.clientWidth = 225;
  w.el.clientHeight = 400;
  w.instance.renderValue({ spec: { mark: "point" } });
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].width, 450);
  assert.equal(calls[1].height, 400);
  assert.equal(w.el._vegaContainer?.style.transform, "scale(0.5)");
});
