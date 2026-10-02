import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DirectAiSettings } from "./DirectAiSettings";
import { aiConfiguration, createAiConfiguration, effectiveAiConfiguration } from "../../game-runtime/airp-configuration";

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("crypto", webcrypto);
  aiConfiguration.patch(createAiConfiguration().getSnapshot());
  await aiConfiguration.persistence.forget();
});
afterEach(() => { cleanup(); aiConfiguration.patch(createAiConfiguration().getSnapshot()); vi.unstubAllGlobals(); });

describe("AIRP settings presentation", () => {
  it("gives the actual game a connection column and a model column without an empty preset sidebar", () => {
    const {container} = render(<DirectAiSettings layout="panel" fixedR8 saveInFooter/>);
    expect(screen.getByRole("region", {name: "AIRP 浏览器直连设置"})).toHaveClass("airp-direct-settings--game");
    expect(container.querySelector(".airp-settings-main")).toContainElement(screen.getByLabelText("公共 API 地址"));
    expect(container.querySelector(".airp-settings-main")).toContainElement(screen.getByLabelText("公共 API Key"));
    for (const label of ["GM模型 ID", "正文模型 ID", "辅助模型 ID"]) {
      expect(screen.getByRole("complementary", {name: "模型分工"})).toContainElement(screen.getByLabelText(label));
    }
    expect(screen.queryByRole("heading", {name: "创作预设"})).toBeNull();
    expect(screen.queryByRole("region", {name: "连接保存"})).toBeNull();
    expect(screen.queryByText(/正式游戏沿用/)).toBeNull();
  });
  it("uses two setting columns with all three models and no fake connection result", () => {
    const {container} = render(<DirectAiSettings layout="panel"/>);
    expect(screen.getByRole("region", {name: "AIRP 浏览器直连设置"})).toHaveClass("airp-direct-settings--panel");
    expect(screen.getByRole("heading", {name: "服务连接"})).toBeInTheDocument();
    expect(screen.getByRole("heading", {name: "创作预设"})).toBeInTheDocument();
    expect(screen.getByLabelText("GM模型 ID")).toHaveValue("gpt-5.6-sol");
    expect(screen.getByLabelText("正文模型 ID")).toHaveValue("gemini-3.8-flash");
    expect(screen.getByLabelText("辅助模型 ID")).toHaveValue("deepseek-flash");
    expect(screen.getByText("尚未保存")).toBeInTheDocument();
    expect(screen.queryByText("已连接")).toBeNull();
    expect(container.querySelector("label label")).toBeNull();
    expect(container.querySelectorAll(".airp-model__advanced[open]")).toHaveLength(0);
    expect(screen.getByLabelText("公共 API Key")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("导入测试配置")).toHaveAttribute("type", "file");
  });

  it("keeps only the essential key hint visible and leaves full preset details collapsed", async () => {
    const before = effectiveAiConfiguration(aiConfiguration.getSnapshot()).material;
    const user = userEvent.setup(); const {container} = render(<DirectAiSettings layout="panel"/>);
    expect(screen.getAllByText("高级参数")).toHaveLength(3);
    expect(screen.queryByText("填写 Base URL 后显示请求地址")).toBeNull();
    const materialNote = screen.getByText(/在场角色卡全文/);
    const usageNote = screen.getByText(/保存地址、Key 和模型，下次自动恢复/);
    expect(materialNote).not.toBeVisible();
    expect(usageNote).not.toBeVisible();
    await user.click(screen.getByText("预设与资料", {exact: true}));
    expect(materialNote).toBeVisible();
    const prefix = container.querySelector(".airp-settings-sources > pre");
    expect(prefix).toBeInTheDocument();
    expect(prefix?.textContent).toBe(before.preset.planningPrefix);
    await user.click(screen.getByText("保存说明", {exact: true}));
    expect(usageNote).toBeVisible();
    expect(effectiveAiConfiguration(aiConfiguration.getSnapshot()).material).toEqual(before);
  });

  it("edits models, shared/independent credentials and parameters without network or material mutation", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const original = effectiveAiConfiguration(aiConfiguration.getSnapshot()).material;
    const user = userEvent.setup(); render(<DirectAiSettings layout="panel"/>);
    fireEvent.change(screen.getByLabelText("公共 API 地址"), {target: {value: "https://example.invalid/v1"}});
    fireEvent.change(screen.getByLabelText("公共 API Key"), {target: {value: "synthetic-shared-key"}});
    // The shared checkbox hides its native input; click its visible label.
    await user.click(screen.getByRole("checkbox", {name: "正文独立连接"}).closest("label")!);
    fireEvent.change(screen.getByLabelText("正文 API 地址"), {target: {value: "https://separate.invalid/v1"}});
    fireEvent.change(screen.getByLabelText("正文 API Key"), {target: {value: "synthetic-writing-key"}});
    fireEvent.change(screen.getByLabelText("正文模型 ID"), {target: {value: "exact-model-id"}});
    fireEvent.change(screen.getByLabelText("正文 temperature"), {target: {value: "0.8"}});
    const effective = effectiveAiConfiguration(aiConfiguration.getSnapshot());
    expect(effective.models.writing.model).toBe("exact-model-id");
    expect(effective.models.writing.baseUrl).toBe("https://separate.invalid/v1");
    expect(effective.models.writing.temperature).toBe(.8);
    expect(effective.keys.writing).toBe("synthetic-writing-key");
    expect(effective.keys.planning).toBe("synthetic-shared-key");
    expect(effective.material.resources).toEqual(original.resources);
    expect(effective.material.preset).toEqual(original.preset);
    expect(screen.getByRole("button", {name: "保存"})).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("有未保存修改");
    expect(screen.queryByLabelText(/口令/)).toBeNull();
    await user.click(screen.getByRole("button", {name: "保存"}));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已保存"));
    const fresh = createAiConfiguration(); await fresh.persistence.initialize();
    expect(effectiveAiConfiguration(fresh.getSnapshot())).toEqual(effective);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("imports the existing config contract and keeps malformed file errors free of input contents", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); render(<DirectAiSettings/>);
    const config = {version: 1, connection: {baseUrl: "https://example.invalid/v1", apiKey: "synthetic-import-key"},
      models: {planning: {model: "planner"}, writing: {model: "writer"}, updater: {model: "formatter"}}};
    const file = new File([JSON.stringify(config)], "test.json", {type: "application/json"});
    Object.defineProperty(file, "text", {value: async () => JSON.stringify(config)});
    fireEvent.change(screen.getByLabelText("导入测试配置"), {target: {files: [file]}});
    await waitFor(() => expect(screen.getByLabelText("GM模型 ID")).toHaveValue("planner"));
    expect(screen.getByLabelText("公共 API Key")).toHaveValue("synthetic-import-key");
    expect(screen.getByText("配置已导入，请保存。")).toBeInTheDocument();
    const invalid = new File(["synthetic-secret-invalid-json"], "invalid.json");
    Object.defineProperty(invalid, "text", {value: async () => "synthetic-secret-invalid-json"});
    fireEvent.change(screen.getByLabelText("导入测试配置"), {target: {files: [invalid]}});
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("配置未导入"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("synthetic-secret");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches one shared list, searches exact IDs and saves selected models without a generation call", async () => {
    const fetch=vi.fn().mockImplementation(async()=>Response.json({data:[{id:"gemini-available"},{id:"gpt-available"}]}));
    vi.stubGlobal("fetch",fetch);
    const user=userEvent.setup(); const {container}=render(<DirectAiSettings layout="panel" fixedR8/>);
    fireEvent.change(screen.getByLabelText("公共 API 地址"),{target:{value:"https://shared.invalid/v1"}});
    fireEvent.change(screen.getByLabelText("公共 API Key"),{target:{value:"synthetic-shared-key"}});
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button",{name:"获取模型列表"}));
    await screen.findByText("已获取 2 个模型");
    await user.click(screen.getByRole("button",{name:"选择GM模型"}));
    const list = await screen.findByRole("listbox", {name:"GM模型列表"});
    expect(container).not.toContainElement(list);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button",{name:"选择GM模型"})).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.getByRole("searchbox",{name:"搜索GM模型"})).toHaveFocus();
    await user.type(screen.getByRole("searchbox",{name:"搜索GM模型"}),"gemini");
    expect(screen.queryByRole("option",{name:"gpt-available"})).toBeNull();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option",{name:"gemini-available"})).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("GM模型 ID")).toHaveValue("gemini-available");
    expect(screen.queryByRole("listbox",{name:"GM模型列表"})).toBeNull();
    expect(screen.getByRole("button",{name:"选择GM模型"})).toHaveFocus();
    await user.click(screen.getByRole("button",{name:"选择正文模型"}));
    await screen.findByRole("listbox", {name:"正文模型列表"});
    await user.click(screen.getByRole("option",{name:"gemini-available"}));
    expect(screen.queryByRole("listbox",{name:"正文模型列表"})).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toEqual(["https://shared.invalid/v1/models",expect.objectContaining({method:"GET"})]);
    await user.click(screen.getByRole("button",{name:"保存"}));
    const restored=createAiConfiguration();await restored.persistence.initialize();
    expect(restored.getSnapshot().models.planning.model).toBe("gemini-available");
    expect(restored.getSnapshot().models.writing.model).toBe("gemini-available");
  });

  it("uses the independent slot key and never presents a previous connection's list after an edit", async () => {
    const fetch=vi.fn().mockImplementation(async()=>Response.json({data:[{id:"writing-only"}]}));vi.stubGlobal("fetch",fetch);
    const user=userEvent.setup();render(<DirectAiSettings fixedR8/>);
    await user.click(screen.getByRole("checkbox",{name:"正文独立连接"}).closest("label")!);
    fireEvent.change(screen.getByLabelText("正文 API 地址"),{target:{value:"https://writing.invalid/v1"}});
    fireEvent.change(screen.getByLabelText("正文 API Key"),{target:{value:"synthetic-writing-key"}});
    await user.click(screen.getByRole("button",{name:"选择正文模型"}));
    await screen.findByRole("option",{name:"writing-only"});
    expect(fetch.mock.calls[0]).toEqual(["https://writing.invalid/v1/models",expect.objectContaining({headers:{Accept:"application/json",Authorization:"Bearer synthetic-writing-key"}})]);
    fireEvent.change(screen.getByLabelText("正文 API 地址"),{target:{value:"https://new.invalid/v1"}});
    expect(screen.queryByRole("option",{name:"writing-only"})).toBeNull();
    await user.click(screen.getByRole("button",{name:"选择GM模型"}));
    expect(screen.queryByRole("option",{name:"writing-only"})).toBeNull();
  });

  it("keeps the anchored list inside its settings dialog, marks the selection and dismisses without closing settings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({data:[{id:"selected-model"},{id:"other-model"}]})));
    const closeSettings = vi.fn(), user = userEvent.setup();
    render(<div role="dialog" aria-label="系统设置" onKeyDown={event => { if (event.key === "Escape") closeSettings(); }}>
      <DirectAiSettings fixedR8/>
    </div>);
    fireEvent.change(screen.getByLabelText("公共 API 地址"), {target:{value:"https://shared.invalid/v1"}});
    fireEvent.change(screen.getByLabelText("公共 API Key"), {target:{value:"synthetic-shared-key"}});
    fireEvent.change(screen.getByLabelText("GM模型 ID"), {target:{value:"selected-model"}});
    await user.click(screen.getByRole("button",{name:"选择GM模型"}));
    expect(await screen.findByRole("option",{name:"selected-model"})).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("dialog",{name:"系统设置"})).toContainElement(screen.getByRole("listbox",{name:"GM模型列表"}));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(closeSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button",{name:"选择GM模型"}));
    await user.click(screen.getByLabelText("公共 API 地址"));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByLabelText("公共 API 地址")).toHaveFocus();
    expect(screen.getByLabelText("GM模型 ID")).toHaveValue("selected-model");
  });

  it("keeps manual entry and existing model IDs when a provider does not support model discovery", async () => {
    const fetch=vi.fn().mockResolvedValue(new Response("synthetic-upstream-secret",{status:404}));vi.stubGlobal("fetch",fetch);
    const user=userEvent.setup();render(<DirectAiSettings fixedR8/>);
    fireEvent.change(screen.getByLabelText("公共 API 地址"),{target:{value:"https://shared.invalid/v1"}});
    fireEvent.change(screen.getByLabelText("公共 API Key"),{target:{value:"synthetic-shared-key"}});
    await user.click(screen.getByRole("button",{name:"选择GM模型"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("此接口未提供模型列表");
    expect(screen.getByLabelText("GM模型 ID")).toHaveValue("gpt-5.6-sol");
    expect(screen.getByRole("alert")).not.toHaveTextContent("synthetic-upstream-secret");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button",{name:"选择GM模型"})).toHaveAttribute("aria-expanded","false");
    expect(screen.queryByRole("listbox",{name:"GM模型列表"})).toBeNull();
    expect(screen.getByRole("button",{name:"选择GM模型"})).toHaveFocus();
    fireEvent.change(screen.getByLabelText("GM模型 ID"),{target:{value:"manually-entered-model"}});
    expect(aiConfiguration.getSnapshot().models.planning.model).toBe("manually-entered-model");
  });
});
