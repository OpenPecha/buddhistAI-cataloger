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
  textname,
  instancename,
  personname,
}) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const currentLanguage = i18n.language;
  const isTibetan = currentLanguage === 'bo';

  const generateBreadcrumbs = (): BreadcrumbItemType[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItemType[] = [];

    if (pathSegments.includes('texts')) {
      breadcrumbs.push({
        label: t('header.texts'),
        href: '/texts',
        icon: <Book className="w-4 h-4" />,
      });

      if (params.text_id && textname) {
        breadcrumbs.push({
          label: textname,
          href: `/texts/${params.text_id}/instances`,
        });
        if (pathSegments.includes('instances')) {
          if (params.instance_id && instancename) {
            breadcrumbs.push({
              label: instancename,
              icon: <FileText className="w-4 h-4" />,
            });
          }
        }
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
