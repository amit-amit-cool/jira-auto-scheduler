'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

export function useSettings() {
  const { settings, isLoaded, loadFromStorage, updateSettings } = useAppStore();

  useEffect(() => {
    if (!isLoaded) loadFromStorage();
  }, [isLoaded, loadFromStorage]);

  return { settings, isLoaded, updateSettings };
}
