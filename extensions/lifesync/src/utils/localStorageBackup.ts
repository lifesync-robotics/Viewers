/**
 * Local Storage Backup Utility
 *
 * Provides backup functionality for registration data to prevent data loss.
 * Stores data in localStorage with expiration and recovery capabilities.
 */

import type { Fiducial } from '../components/Registration/types';

export interface BackupData {
  fiducials: Fiducial[];
  templateId?: string | null;
  registrationId?: string | null;
  seriesInstanceUID: string;
  timestamp: number;
  mode: 'template' | 'registration';
}

const STORAGE_PREFIX = 'registration_backup_';
const EXPIRATION_HOURS = 24; // Data expires after 24 hours

/**
 * Save registration data to localStorage as backup
 */
export function saveBackup(
  seriesInstanceUID: string,
  data: {
    fiducials: Fiducial[];
    templateId?: string | null;
    registrationId?: string | null;
    mode: 'template' | 'registration';
  }
): void {
  try {
    const backup: BackupData = {
      ...data,
      seriesInstanceUID,
      timestamp: Date.now(),
    };

    const key = `${STORAGE_PREFIX}${seriesInstanceUID}`;
    localStorage.setItem(key, JSON.stringify(backup));
    console.log(`💾 Backup saved for series: ${seriesInstanceUID}`);
  } catch (error) {
    // localStorage might be full or disabled
    console.warn('⚠️ Failed to save backup to localStorage:', error);
  }
}

/**
 * Load backup data from localStorage
 */
export function loadBackup(seriesInstanceUID: string): BackupData | null {
  try {
    const key = `${STORAGE_PREFIX}${seriesInstanceUID}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    const backup: BackupData = JSON.parse(stored);

    // Check expiration
    const ageHours = (Date.now() - backup.timestamp) / (1000 * 60 * 60);
    if (ageHours > EXPIRATION_HOURS) {
      console.log(`⏰ Backup expired (${ageHours.toFixed(1)} hours old)`);
      localStorage.removeItem(key);
      return null;
    }

    // Verify series UID matches
    if (backup.seriesInstanceUID !== seriesInstanceUID) {
      console.warn('⚠️ Backup series UID mismatch');
      return null;
    }

    console.log(
      `📥 Backup loaded for series: ${seriesInstanceUID} (${ageHours.toFixed(1)} hours old)`
    );
    return backup;
  } catch (error) {
    console.warn('⚠️ Failed to load backup from localStorage:', error);
    return null;
  }
}

/**
 * Clear backup data for a series
 */
export function clearBackup(seriesInstanceUID: string): void {
  try {
    const key = `${STORAGE_PREFIX}${seriesInstanceUID}`;
    localStorage.removeItem(key);
    console.log(`🗑️ Backup cleared for series: ${seriesInstanceUID}`);
  } catch (error) {
    console.warn('⚠️ Failed to clear backup:', error);
  }
}

/**
 * Check if backup exists and is valid
 */
export function hasValidBackup(seriesInstanceUID: string): boolean {
  const backup = loadBackup(seriesInstanceUID);
  return backup !== null;
}

/**
 * Get backup age in hours
 */
export function getBackupAge(seriesInstanceUID: string): number | null {
  const backup = loadBackup(seriesInstanceUID);
  if (!backup) {
    return null;
  }
  return (Date.now() - backup.timestamp) / (1000 * 60 * 60);
}
