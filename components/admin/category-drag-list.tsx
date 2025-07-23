'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GripVertical, 
  Edit, 
  Trash2,
  FolderOpen
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  videoCount: number;
  sortOrder: number;
  _count: {
    videos: number;
  };
}

interface CategoryDragListProps {
  categories: Category[];
  onReorder: (newOrder: Category[]) => void;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

interface SortableCategoryItemProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

function SortableCategoryItem({ category, onEdit, onDelete }: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className={`transition-all duration-200 ${isDragging ? 'shadow-lg scale-105' : 'hover:shadow-md'}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>

            {/* Category Color */}
            <div
              className="w-4 h-4 rounded-full border border-gray-300"
              style={{ backgroundColor: category.color }}
            />

            {/* Category Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm">{category.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  <FolderOpen className="w-3 h-3 mr-1" />
                  {category.videoCount || category._count?.videos || 0}
                </Badge>
              </div>
              {category.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {category.description}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                スラッグ: {category.slug}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(category)}
                className="h-8 w-8 p-0"
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(category.id)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CategoryDragList({ categories, onReorder, onEdit, onDelete }: CategoryDragListProps) {
  const [items, setItems] = useState(categories);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update items when categories prop changes
  React.useEffect(() => {
    setItems(categories);
  }, [categories]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      
      // Update sortOrder for each item
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        sortOrder: index
      }));
      
      setIsReordering(true);
      try {
        await onReorder(updatedItems);
      } catch (error) {
        console.error('Failed to reorder categories:', error);
        // Revert on error
        setItems(categories);
      } finally {
        setIsReordering(false);
      }
    }
  };

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        カテゴリがありません
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        ドラッグ&ドロップで並び順を変更できます
      </div>
      
      {isReordering && (
        <div className="text-sm text-blue-600 mb-2">
          並び順を更新中...
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          {items.map((category) => (
            <SortableCategoryItem
              key={category.id}
              category={category}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
} 