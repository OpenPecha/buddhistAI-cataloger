type Label = 'FRONT_MATTER' | 'TOC' | 'TEXT' | 'BACK_MATTER';

export function getLabelColor(label: Label){
    switch(label){
        case 'FRONT_MATTER':
            return 'bg-amber-100 text-amber-800';
        case 'TOC':
            return 'bg-indigo-100 text-indigo-800';
        case 'TEXT':
            return 'bg-green-100 text-green-800';
        case 'BACK_MATTER':
            return 'bg-gray-100 text-gray-800';
    }
}


export function getStatusColor(status:Status){
    switch(status){
        case 'unchecked':
            return 'bg-gray-100 text-gray-800';
        case 'checked':
            return 'bg-green-100 text-green-800';
        case 'approved':
            return 'bg-blue-100 text-blue-800';
        case 'rejected':
            return 'bg-red-100 text-red-800';
    }
}