import { invoke } from "@tauri-apps/api/core";

export async function getGreeting(locale: string): Promise<string> {
  return invoke<string>("get_greeting", { locale });
}
