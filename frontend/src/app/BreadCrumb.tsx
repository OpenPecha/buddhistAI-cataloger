import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Book, FileText } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useTranslation } from 'react-i18next';
import { useEdition, useText } from '@/hooks/useTexts';

interface BreadcrumbItemType {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadCrumbProps {
  items?: BreadcrumbItemType[];
  className?: string;
  textname?: string;
  instancename?: string;
  personname?: string;
}

const BreadCrumb: React.FC<BreadCrumbProps> = ({
  items,
  className = '',
  personname,
}) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const currentLanguage = i18n.language;
  const isTibetan = currentLanguage === 'bo';
  const text_id = params.text_id;
  const edition_id = params.edition_id;
  const { data: text, isFetched: isTextFetched } = useText(text_id || '');
  const { data: edition, isFetched: isEditionFetched } = useEdition(edition_id || '');
  const textname = text?.title.tib || text?.title.bo || text?.title.en || "Content";

  const editiontype=edition?.metadata.type;

  const generateBreadcrumbs = (): BreadcrumbItemType[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItemType[] = [];

    if (pathSegments.includes('texts')) {
      breadcrumbs.push({
        label: t('header.texts'),
        href: '/texts',
        icon: <Book className="w-4 h-4" />,
      });

      if (textname && text_id) {
        breadcrumbs.push({
          label: textname,
          href: `/texts/${params.text_id}/editions`,
        });
      
      }
      if (params.edition_id &&editiontype) {
        breadcrumbs.push({
          label: editiontype,
          icon: <FileText className="w-4 h-4" />,
        });
     
      }
    } else if (pathSegments.includes('persons') && personname) {
      breadcrumbs.push({
        label: personname,
        href: '/persons',
        icon: <Book className="w-4 h-4" />,
      });
    }

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();
  return (
    <Breadcrumb className={className + ' ' + (isTibetan ? 'font-monlam' : '')}>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={`breadcrumb-${item.label}-${index}`}>
            <BreadcrumbItem>
              {item.href && index < breadcrumbItems.length - 1 ? (
                <BreadcrumbLink asChild>
                  <Link to={item.href} className="flex items-center space-x-1">
                    {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                    <span>{item.label}</span>
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="flex items-center space-x-1">
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span>{item.label}</span>
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default BreadCrumb;
