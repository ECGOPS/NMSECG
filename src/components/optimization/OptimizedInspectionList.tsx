/**
 * OptimizedInspectionList - Memoized list component for better rendering performance
 * 
 * Usage:
 * <OptimizedInspectionList items={inspections} renderItem={(item) => <InspectionCard item={item} />} />
 */

import React from 'react';

interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

/**
 * Memoized list item component to prevent unnecessary re-renders
 */
const MemoizedListItem = React.memo(<T,>({ 
  item, 
  index, 
  renderItem 
}: { 
  item: T; 
  index: number; 
  renderItem: (item: T, index: number) => React.ReactNode;
}) => {
  return <>{renderItem(item, index)}</>;
}) as <T,>(props: { 
  item: T; 
  index: number; 
  renderItem: (item: T, index: number) => React.ReactNode;
}) => React.ReactElement;

MemoizedListItem.displayName = 'MemoizedListItem';

/**
 * Optimized list component with React.memo for items
 */
export function OptimizedInspectionList<T extends { id: string }>({
  items,
  renderItem,
  emptyMessage = "No items found",
  className = ""
}: OptimizedListProps<T>) {
  if (items.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <MemoizedListItem
          key={item.id}
          item={item}
          index={index}
          renderItem={renderItem}
        />
      ))}
    </div>
  );
}

/**
 * For very large lists (1000+ items), consider using react-window or react-virtualized
 * Example with react-window:
 * 
 * import { FixedSizeList } from 'react-window';
 * 
 * export function VirtualizedInspectionList<T extends { id: string }>({
 *   items,
 *   renderItem,
 *   itemHeight = 100,
 *   className = ""
 * }: OptimizedListProps<T> & { itemHeight?: number }) {
 *   return (
 *     <FixedSizeList
 *       height={600}
 *       itemCount={items.length}
 *       itemSize={itemHeight}
 *       width="100%"
 *       className={className}
 *     >
 *       {({ index, style }) => (
 *         <div style={style}>
 *           {renderItem(items[index], index)}
 *         </div>
 *       )}
 *     </FixedSizeList>
 *   );
 * }
 */

