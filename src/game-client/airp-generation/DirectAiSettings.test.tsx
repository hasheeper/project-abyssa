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
});
