import type { ChangeEventHandler } from "react";

import type { Translator } from "../../../app/i18n/translator";

type CompressionLevelSelectProps = Readonly<{
  id: string;
  className?: string;
  value: number | null;
  i18n: Translator;
  onChange: ChangeEventHandler<HTMLSelectElement>;
}>;

export function CompressionLevelSelect({ id, className, value, i18n, onChange }: CompressionLevelSelectProps) {
  return (
    <select id={id} className={className} value={value ?? ""} onChange={onChange}>
      <option value="">{i18n.t("preferences.archiveDefaults.backendDefault")}</option>
      <option value="0">{i18n.t("common.store")}</option>
      <option value="1">{i18n.t("common.fastest")}</option>
      <option value="3">{i18n.t("common.fast")}</option>
      <option value="9">{i18n.t("common.maximum")}</option>
      <option value="22">{i18n.t("common.ultra")}</option>
    </select>
  );
}
