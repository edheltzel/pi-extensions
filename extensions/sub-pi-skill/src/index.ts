import { loadConfigOrDefault } from "@edheltzel/pi-config";
import { DEFAULT_OPTIONS, subPiSkill } from "@edheltzel/pi-sub-pi-skill";
import { z } from "zod";

const ConfigSchema = z.object({
  toolName: z.string().default(DEFAULT_OPTIONS.toolName),
});

const config = loadConfigOrDefault({
  filename: "sub-pi-skill.jsonc",
  schema: ConfigSchema,
});

export default subPiSkill(config);
