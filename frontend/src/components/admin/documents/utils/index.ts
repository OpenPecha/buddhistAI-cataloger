export function getDefaultDateRange() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }


export const STATUS_DIVIDER_COLORS: Record<string, string> = {
    completed: 'bg-green-500',
    approved: 'bg-blue-500',
    rejected: 'bg-red-500',
    active: 'bg-yellow-500',
}

export const STATUS_COLORS: Record<string, string> = {
    completed: 'text-green-700',
    approved: 'text-blue-700',
    rejected: 'text-red-700',
    active: 'text-yellow-700',
}
export const STATUS_BACKGROUND_COLORS: Record<string, string> = {
    completed: 'bg-green-50',
    approved: 'bg-blue-50',
    rejected: 'bg-red-50',
    active: 'bg-yellow-50',
}
const STATUS_BORDER_COLORS: Record<string, string> = {
    completed: 'border-green-200',
    approved: 'border-blue-200',
    rejected: 'border-red-200',
    active: 'border-yellow-200',
}

export function getStatusColor(status:string){
    return STATUS_COLORS[status] || STATUS_COLORS.default;
}

export function getBackgroundColor(status:string){
    return STATUS_BACKGROUND_COLORS[status] || STATUS_BACKGROUND_COLORS.active;
}

export function getStatusBorderColor(status:string){
    return STATUS_BORDER_COLORS[status] || STATUS_BORDER_COLORS.default;
}

export function getStatusBadgeClass(status:string){
    return STATUS_BACKGROUND_COLORS[status]+ ' ' + STATUS_COLORS[status] + ' ' + STATUS_BORDER_COLORS[status];
}

