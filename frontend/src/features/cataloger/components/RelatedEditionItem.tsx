import TextCard from "@/components/TextCard";
import { useText } from "@/hooks/useTexts";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

function RelatedInstanceItem({ sourceInstanceId,relatedInstance }: { sourceInstanceId:string,relatedInstance: RelatedInstance }) {
    const textId = relatedInstance.text_id;
    const instanceId =relatedInstance.id;
    const {t} = useTranslation();
    const {data:textDetails} =useText(textId);
    const title = textDetails?.title?.bo|| textDetails?.title?.tib||textDetails?.title?.tibphono || textDetails?.title?.en || textDetails?.title?.sa || textDetails?.title?.pi || t('textInstances.untitled');
    const type=textDetails?.translation_of ? 'translation' : textDetails?.commentary_of ? 'commentary' : 'source';
    function getEditionLink(){
      return `/texts/${textId}/editions`;
    }
    return <Link
        key={instanceId}
        to={getEditionLink()}
        className="contents"
        >
         <TextCard
           title={title}
           language={textDetails?.language || ''}
           type={type}
           instanceId={instanceId}
           sourceInstanceId={sourceInstanceId}
           />
       </Link>
  
  }

  export default RelatedInstanceItem