import { X, MessageCircle } from 'lucide-react';
import type { Segment } from '../shared/types';
import CommentView from '@/components/outliner/comment/CommentView';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import Comments from '@/components/outliner/comment/Comment';

interface SegmentSidebarProps {
  readonly segment: Segment | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function SegmentSidebar({ segment, isOpen, onClose }: SegmentSidebarProps) {

if (!segment) return null;

return (
    <Drawer open={isOpen} onOpenChange={onClose} direction='right'>
      <DrawerContent className="w-96">
        <DrawerHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <DrawerTitle className="text-lg font-semibold text-gray-900">
                Segment Details
              </DrawerTitle>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="p-4">

        <Comments segmentId={segment.id} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default SegmentSidebar;