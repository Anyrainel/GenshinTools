import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactTextResource,
  weaponTextResource,
} from "@/providers/reference/gameDataLoader";
import { useResource } from "./useResource";

export function useWeaponText() {
  const { language } = useLanguage();
  return useResource(weaponTextResource, language);
}

export function useArtifactText() {
  const { language } = useLanguage();
  return useResource(artifactTextResource, language);
}
