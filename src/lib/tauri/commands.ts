import { invoke } from "@tauri-apps/api/core";

export async function getGreeting(locale: string): Promise<string> {
  return invoke<string>("get_greeting", { locale });
}

export async function validateLocalMappingDirectory(path: string): Promise<boolean> {
  return invoke<boolean>("validate_local_mapping_directory", { path });
}
