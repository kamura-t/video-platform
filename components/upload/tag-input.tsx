'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Plus, Tag } from 'lucide-react';

interface TagInputProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export const TagInput: React.FC<TagInputProps> = ({
  availableTags,
  selectedTags,
  onTagsChange,
  placeholder = 'タグを追加...',
  maxTags = 5,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // デバッグログ
  useEffect(() => {
    console.log('TagInput - selectedTags changed:', selectedTags);
  }, [selectedTags]);

  console.log('TagInput - selectedTags:', selectedTags);
  console.log('TagInput - availableTags:', availableTags);

  const filteredSuggestions = availableTags.filter(
    tag => {
      // 入力がない場合は全ての既存タグを表示
      if (!inputValue.trim()) {
        return !selectedTags.includes(tag);
      }
      // 入力がある場合は部分一致で絞り込み
      return tag.toLowerCase().includes(inputValue.toLowerCase()) &&
        !selectedTags.includes(tag);
    }
  );

  const addTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim();
    if (
      trimmedTag &&
      !selectedTags.includes(trimmedTag) &&
      selectedTags.length < maxTags
    ) {
      onTagsChange([...selectedTags, trimmedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  }, [selectedTags, onTagsChange, maxTags]);

  const removeTag = useCallback((tagToRemove: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagToRemove));
  }, [selectedTags, onTagsChange]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(true);
  };

  const handleInputFocus = () => {
    // フォーカス時に既存タグの候補を表示
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="flex items-center gap-1 px-3 py-1"
            >
              <Tag className="w-3 h-3" />
              <span>{tag}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1 hover:bg-transparent"
                onClick={() => removeTag(tag)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <div className="relative">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={
              selectedTags.length >= maxTags
                ? `最大${maxTags}個のタグまで追加できます`
                : placeholder
            }
            disabled={selectedTags.length >= maxTags}
            className="pr-10"
          />
          {inputValue && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => addTag(inputValue)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Suggestions */}
        {showSuggestions && filteredSuggestions.length > 0 && selectedTags.length < maxTags && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg">
            <div 
              className="max-h-60 overflow-y-auto overscroll-contain"
              onWheel={(e) => {
                // スクロールイベントの伝播を防ぐ
                e.stopPropagation();
                const target = e.currentTarget;
                const { scrollTop, scrollHeight, clientHeight } = target;
                
                // 上端または下端に達した場合のみ、デフォルトの動作を防ぐ
                if (
                  (e.deltaY < 0 && scrollTop === 0) ||
                  (e.deltaY > 0 && scrollTop + clientHeight >= scrollHeight)
                ) {
                  e.preventDefault();
                }
              }}
            >
              <div className="p-1">
                {!inputValue.trim() && (
                  <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
                    既存のタグから選択 ({filteredSuggestions.length}個)
                  </div>
                )}
                {filteredSuggestions.map((tag) => (
                  <Button
                    key={tag}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2 text-sm hover:bg-accent"
                    onClick={() => addTag(tag)}
                  >
                    <Tag className="w-3 h-3 mr-2" />
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tag Counter */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {selectedTags.length}/{maxTags} タグ
        </span>
        {inputValue && !selectedTags.includes(inputValue.trim()) && (
          <span>
            Enterキーで「{inputValue}」を追加
          </span>
        )}
      </div>
    </div>
  );
};