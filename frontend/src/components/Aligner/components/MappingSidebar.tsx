import { useState } from "react";
import { useEditorContext } from "../context";
import { useTextSelectionStore } from "../../../stores/textSelectionStore";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import segmentsToAlignmentPayload from "@/features/cataloger/lib/alignment_generator";
import { usePostEditionAlignments } from "@/hooks/useTexts";

const MappingSidebar = () => {
  const { t } = useTranslation();
  const { getSourceContent, getTargetContent, isContentValid } =
    useEditorContext();
  const {
    sourceInstanceId,
    targetInstanceId,
    hasAlignment,
  } = useTextSelectionStore();
  const createAlignmentMutation = usePostEditionAlignments();

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = () => {
    proceedWithSave();
  };

  const proceedWithSave = () => {
    if (!sourceInstanceId || !targetInstanceId) {
      setSaveError(t("mapping.sourceAndTargetRequired"));
      return;
    }

    if (!isContentValid()) {
      setSaveError(t("mapping.contentModifiedError"));
      return;
    }

    const sourceContent = getSourceContent();
    const targetContent = getTargetContent();
    // URL source = aligned edition text; URL target = root edition text.
    // API target_segments are on the root edition; aligned_segments on the aligned edition.
    const payload = segmentsToAlignmentPayload({
      targetId: targetInstanceId,
      targetTexts: targetContent?.split("\n"),
      alignedTexts: sourceContent?.split("\n"),
      metadata: {},
    });

    createAlignmentMutation.mutate(
      {
        editionId: sourceInstanceId,
        rootEditionId: targetInstanceId,
        payload,
      },
      {
        onSuccess: () => {
          setSaveError(null);
          const msg = hasAlignment
            ? "Alignment updated successfully."
            : "Alignment published successfully.";
          setSaveSuccess(msg);
          toast.success(msg);
        },
        onError: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : "Unable to save alignment. Please try again.";
          setSaveSuccess(null);
          setSaveError(message);
          toast.error(message);
        },
      }
    );
  };

  const isPublishing = createAlignmentMutation.isPending;

  return (
    <>
      {isPublishing && (
        <div className="fixed inset-0 bg-black/60 bg-opacity-60 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl p-8 flex flex-col items-center gap-4 min-w-[300px]">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <div className="text-gray-700 text-lg font-medium">
              {hasAlignment
                ? "Updating alignment..."
                : "Publishing alignment..."}
            </div>
            <div className="text-gray-500 text-sm">
              Please wait while we save your changes
            </div>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{saveSuccess}</p>
        </div>
      )}

      {saveError && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{saveError}</p>
        </div>
      )}

      <SaveButton
        hasAlignment={hasAlignment}
        handleSave={handleSave}
        disabled={isPublishing}
      />
    </>
  );
};

export default MappingSidebar;

function SaveButton({
  hasAlignment,
  handleSave,
  disabled,
}: {
  hasAlignment: boolean;
  handleSave: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={handleSave}
      className=" h-full bg-blue-600 px-4 cursor-pointer hover:bg-blue-700 text-white font-poppins disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={disabled}
    >
      {hasAlignment ? "Update" : "Publish"}
    </button>
  );
}
