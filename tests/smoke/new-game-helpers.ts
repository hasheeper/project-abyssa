import { expect, type Page } from "@playwright/test";

/** The title's new-game window is already open. No save until final confirm. */
export async function prepareNewGame(page: Page, label: string, name = "你") {
  const input = page.getByRole("textbox", {name: "请输入角色姓名"});
  await expect(input).toBeEnabled();
  await input.fill(name);
  await page.getByRole("button", {name: /下一步/}).click();
  if (label.includes("调试")) {
    await page.getByText("调试入口", {exact: true}).click();
    await page.getByRole("button", {name: label, exact: true}).click();
  } else {
    await page.getByRole("radio", {name: new RegExp(label)}).click();
    await page.getByRole("button", {name: /下一步/}).click();
  }
  await expect(page.getByRole("heading", {name: "确认开始"})).toBeVisible();
}
export async function confirmNewGame(page: Page, label: string, name = "你") {
  await prepareNewGame(page, label, name);
  await page.getByRole("button", {name: /开始游戏/}).click();
}
