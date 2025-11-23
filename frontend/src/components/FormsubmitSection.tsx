import React from 'react'
import { Button } from './ui/button'
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

function FormsubmitSection({
    onCancel,
    onSubmit,
    isSubmitting,
    disableSubmit,
}: {
 readonly   onCancel?: () => void;
 readonly   onSubmit?: () => void;
 readonly    isSubmitting: boolean;
 readonly    disableSubmit: boolean;
}) {

const { t } = useTranslation();
const params = useParams();
const instance_id = params.instance_id as string;
const disabled = isSubmitting || disableSubmit;
  return (<div className="flex justify-center space-x-3 pt-4">
    {onCancel && (
      <Button type="button" variant="outline" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
    )}
    <Button type="button" onClick={onSubmit} disabled={disabled} variant="default" className="cursor-pointer bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white py-3" >
      {isSubmitting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          {t("instance.creating")}
        </>
      ) : (
        <>
        {instance_id ? t("common.update") : t("common.create")}
        </>
      )}
    </Button>
  </div>
  )
}

export default FormsubmitSection
