import React from 'react';
import { PlusCircle } from 'lucide-react';
import type { OpenPechaTextInstance } from '../../../types/text';

type Instance = OpenPechaTextInstance;

interface InstanceSelectorProps {
  selectedTextId: string;
  selectedInstanceId: string | null;
  availableInstances: Instance[];
  isLoadingInstances: boolean;
  isLoadingInstance: boolean;
  instancesError: Error | null;
  instanceError: Error | null;
  onInstanceSelect: (instanceId: string) => void;
  onCreateText: () => void;
}

export function InstanceSelector({
  selectedTextId,
  selectedInstanceId,
  availableInstances,
  isLoadingInstances,
  isLoadingInstance,
  instancesError,
  instanceError,
  onInstanceSelect,
  onCreateText,
}: InstanceSelectorProps) {
  if (!selectedTextId) {
    return null;
  }

  

  return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <select
              id="source-instance-select"
              value={selectedInstanceId || ""}
              onChange={(e) => onInstanceSelect(e.target.value)}
              disabled={isLoadingInstances || isLoadingInstance}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">
                {(() => {
                  if (isLoadingInstances) return 'Loading instances...';
                  if (instancesError) return 'Error loading instances';
                  if (availableInstances?.length === 0) return 'No instances found';
                  return 'Choose an instance...';
                })()}
              </option>
              {availableInstances.map((instance) => {
                if (!instance) return null;

                return (
                  <option key={instance.id} value={instance.id}>
                    {instance.type || 'Instance'} - Version
                  </option>
                );
              })}
            </select>
           
          </div>
          {instancesError && (
            <p className="text-sm text-red-600">
              Failed to load available instances: {instancesError.message}
            </p>
          )}
          {instanceError && (
            <p className="text-sm text-red-600">Failed to load instance: {instanceError.message}</p>
          )}
        </div>
      </div>
  );
}

