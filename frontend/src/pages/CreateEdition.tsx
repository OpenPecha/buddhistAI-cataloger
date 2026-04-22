import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import TextCreation, {
  type TextCreationEmbeddedConfig,
} from "@/components/textCreation/TextCreation";

function normalizeCreateType(
  raw: string | null
): TextCreationEmbeddedConfig["createType"] {
  if (raw === "translation" || raw === "commentary" || raw === "edition") {
    return raw;
  }
  return "edition";
}

function CreateEdition() {
  const { text_id } = useParams();
  const [params] = useSearchParams();
  const typeParam = params.get("type");

  const embedded = useMemo((): TextCreationEmbeddedConfig | undefined => {
    if (!text_id) return undefined;
    return {
      forceNewText: true,
      createType: normalizeCreateType(typeParam),
      parentTextId: text_id,
    };
  }, [text_id, typeParam]);

  if (!text_id) {
    return (
      <div className="p-8 text-center text-gray-600">
        Missing text id in the URL.
      </div>
    );
  }

  return <TextCreation embedded={embedded} />;
}

export default CreateEdition;
