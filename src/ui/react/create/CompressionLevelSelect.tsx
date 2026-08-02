import type { Translator } from "../../../app/i18n/translator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type CompressionLevelSelectProps = Readonly<{
  id: string;
  className?: string;
  value: number | null;
  i18n: Translator;
  onChange: (value: string) => void;
}>;

export function CompressionLevelSelect({
  id,
  className,
  value,
  i18n,
  onChange,
}: CompressionLevelSelectProps) {
  return (
    <Select
      value={value === null ? "default" : String(value)}
      onValueChange={(newValue) =>
        onChange(newValue === "default" ? "" : newValue)
      }
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">
          {i18n.t("preferences.archiveDefaults.backendDefault")}
        </SelectItem>
        <SelectItem value="0">{i18n.t("common.store")}</SelectItem>
        <SelectItem value="1">{i18n.t("common.fastest")}</SelectItem>
        <SelectItem value="3">{i18n.t("common.fast")}</SelectItem>
        <SelectItem value="9">{i18n.t("common.maximum")}</SelectItem>
        <SelectItem value="22">{i18n.t("common.ultra")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
