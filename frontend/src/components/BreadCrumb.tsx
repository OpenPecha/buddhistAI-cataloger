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

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadCrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
  textname?: string;
  instancename?: string;
  personname?: string;
}

const BreadCrumb: React.FC<BreadCrumbProps> = ({ items, className = '',textname,instancename,personname }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  // Generate breadcrumb items based on current route
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
    ];

    // Handle different routes
    if (pathSegments.includes('texts')) {
      breadcrumbs.push({ 
        label: t('header.texts'), 
        href: '/texts', 
        icon: <Book className="w-4 h-4" /> 
      });

      // If we have a text_id parameter
      if (params.text_id && textname) {
        // For now, we'll use the text_id as the label
        // In a real app, you might want to fetch the actual text title
        breadcrumbs.push({ 
          label: textname, 
          href: `/texts/${params.text_id}/instances` 
        });
        // If we're in instances
        if (pathSegments.includes('instances')) {
            if (params.instance_id && instancename) {
                breadcrumbs.push({ 
                    label: instancename, 
                    icon: <FileText className="w-4 h-4" /> 
                });
            }
        }
    }
    } else if (pathSegments.includes('persons') && personname) {
      breadcrumbs.push({ 
        label: personname, 
        href: '/persons', 
        icon: <Book className="w-4 h-4" /> 
      });
    }

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  return (
    <Breadcrumb className={className+" "}>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={`breadcrumb-${item.label}-${index}`}>
            <BreadcrumbItem>
              {item.href && index < breadcrumbItems.length - 1 ? (
                <BreadcrumbLink asChild>
                  <Link
                    to={item.href}
                    className="flex items-center space-x-1"
                  >
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