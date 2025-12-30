import type { OpenPechaText } from '../types/text';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import TextListCard from './TextListCard';

const TextList = ({texts}: {texts: OpenPechaText[]}) => {
  return (
    <div className="container mx-auto px-4 py-8">
 

      {texts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-xl">No texts found</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow >
              <TableHead className="w-[100px] font-extrabold text-neutral-700">Text</TableHead>
              <TableHead className="font-extrabold text-neutral-700">BDRC ID</TableHead>
              <TableHead className="font-extrabold text-neutral-700">Type</TableHead>
              <TableHead className="font-extrabold text-neutral-700">Language</TableHead>
              <TableHead className="text-right font-extrabold text-neutral-700">Contributors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {texts.map((text: OpenPechaText) => (
            <TextListCard key={text.id} text={text} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};




export default TextList;
