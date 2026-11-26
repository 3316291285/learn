/**
 * tool-calling 验收测试 — TDD 规格，请勿修改本文件
 * 12 个用例覆盖：安全解析 / 错误即观察 / 多轮不同工具 / 自我修正 / 死循环熔断
 */
import { describe, it, expect } from "vitest";
import {
  mockClient,
  parseToolArgs,
  executeToolCall,
  runAgent,
  type ToolRegistry,
  type ModelResponse,
} from "./starter.js";

const registry: ToolRegistry = {
  get_weather: {
    name: "get_weather",
    description: "查询城市天气",
    parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
    run: (args: { city: string }) =>
      args.city === "北京"
        ? { city: "北京", temp: 22, condition: "多云" }
        : { city: args.city, temp: 30, condition: "晴" },
  },
  get_clothing_advice: {
    name: "get_clothing_advice",
    description: "根据温度给穿衣建议",
    parameters: { type: "object", properties: { temp: { type: "number" } }, required: ["temp"] },
    run: (args: { temp: number }) => (args.temp < 25 ? "建议穿薄外套" : "短袖即可"),
  },
};

describe("TODO 1 · parseToolArgs", () => {
  it("合法 JSON → ok=true + 解析出的对象", () => {
    const r = parseToolArgs('{"city": "北京"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.args).toEqual({ city: "北京" });
  });

  it("非法 JSON（截断）→ 不抛异常，返回含 JSON 字样的可行动错误", () => {
    const r = parseToolArgs('{"city": 北京');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });
});

describe("TODO 2 · executeToolCall（错误即观察）", () => {
  const call = (name: string, args: string) => ({ id: "call_1", function: { name, arguments: args } });

  it("成功执行 → 结果 JSON 字符串化", () => {
    expect(JSON.parse(executeToolCall(registry, call("get_weather", '{"city":"北京"}'))))
      .toEqual({ city: "北京", temp: 22, condition: "多云" });
  });

  it("未知工具名 → 错误观察而非抛异常", () => {
    const out = executeToolCall(registry, call("get_stock", '{"code":"AAPL"}'));
    expect(JSON.parse(out).error).toBeTruthy();
  });

  it("参数非法 → 错误观察", () => {
    expect(JSON.parse(executeToolCall(registry, call("get_weather", "{bad"))).error).toBeTruthy();
  });

  it("run 抛异常 → 错误观察（下游故障也是观察）", () => {
    const bad: ToolRegistry = {
      boom: { ...registry.get_weather!, name: "boom", run: () => { throw new Error("下游 API 挂了"); } },
    };
    expect(JSON.parse(executeToolCall(bad, call("boom", "{}"))).error).toContain("下游 API");
  });
});

describe("TODO 3 · runAgent（多轮循环）", () => {
  it("场景1 单轮调用：查天气后回答，历史消息结构正确", async () => {
    const client = mockClient([
      { content: null, tool_calls: [{ id: "c1", function: { name: "get_weather", arguments: '{"city":"北京"}' } }] },
      { content: "北京 22°C 多云，适合出门。", tool_calls: [] },
    ]);
    const r = await runAgent(client, registry, "北京天气如何");

    expect(r.answer).toBe("北京 22°C 多云，适合出门。");
    expect(r.steps).toBe(2);
    expect(r.messages.map(m => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(r.messages[2]).toMatchObject({ role: "tool", tool_call_id: "c1" });
    // assistant 的 tool_calls 意图必须原样保留在历史里（模型每轮重读全部历史）
    expect(r.messages[1].tool_calls?.[0].function.name).toBe("get_weather");
    expect(r.messages[1].tool_calls?.[0].id).toBe("c1");
  });

  it("场景2 多轮不同工具：天气结果喂给穿衣建议（多步=正常）", async () => {
    const client = mockClient([
      { content: null, tool_calls: [{ id: "c1", function: { name: "get_weather", arguments: '{"city":"北京"}' } }] },
      { content: null, tool_calls: [{ id: "c2", function: { name: "get_clothing_advice", arguments: '{"temp":22}' } }] },
      { content: "22°C，建议穿薄外套。", tool_calls: [] },
    ]);
    const r = await runAgent(client, registry, "北京穿什么");

    expect(r.steps).toBe(3);
    expect(r.answer).toContain("薄外套");
    const toolMsgs = r.messages.filter(m => m.role === "tool");
    expect(toolMsgs).toHaveLength(2);
    expect(toolMsgs[1]).toMatchObject({ tool_call_id: "c2" });
    expect(JSON.parse(toolMsgs[1].content)).toBe("建议穿薄外套");
  });

  it("场景3 非法 JSON → 错误观察回传 → 模型下一轮自我修正", async () => {
    const client = mockClient([
      { content: null, tool_calls: [{ id: "c1", function: { name: "get_weather", arguments: '{"city": 北京' } }] },
      { content: null, tool_calls: [{ id: "c2", function: { name: "get_weather", arguments: '{"city":"北京"}' } }] },
      { content: "好了，北京 22°C。", tool_calls: [] },
    ]);
    const r = await runAgent(client, registry, "北京天气");

    expect(r.steps).toBe(3);
    const firstTool = r.messages.find(m => m.role === "tool")!;
    expect(firstTool.tool_call_id).toBe("c1");
    expect(JSON.parse(firstTool.content).error).toBeTruthy();   // 第一次回传的是错误观察
    expect(r.answer).toBe("好了，北京 22°C。");                  // 修正后成功
  });

  it("场景4 调用不存在的工具 → 错误观察 → 模型放弃工具直接回答", async () => {
    const client = mockClient([
      { content: null, tool_calls: [{ id: "c1", function: { name: "nonexistent_tool", arguments: "{}" } }] },
      { content: "抱歉，我没有可用的股票查询工具。", tool_calls: [] },
    ]);
    const r = await runAgent(client, registry, "帮我查股票");

    expect(r.answer).toContain("抱歉");
    expect(JSON.parse((r.messages[2] as any).content).error).toBeTruthy();
  });

  it("场景5 模型卡死反复调用 → maxSteps 熔断", async () => {
    const loop: ModelResponse = {
      content: null,
      tool_calls: [{ id: "cx", function: { name: "get_weather", arguments: '{"city":"北京"}' } }],
    };
    const client = mockClient(Array(20).fill(loop));
    await expect(runAgent(client, registry, "死循环测试", 5)).rejects.toThrow(/步数|steps|max/i);
  });
});
