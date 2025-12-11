'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Channel } from '@/lib/types';

interface Props {
  channels: Channel[];
  selectedChannel?: string;
}

export function FilterBar({ channels, selectedChannel }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value) {
      params.set('channel', value);
    } else {
      params.delete('channel');
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="filter-bar">
      <label className="filter-label" htmlFor="channel">
        Filter by channel
      </label>
      <select
        id="channel"
        name="channel"
        className="filter-select"
        value={selectedChannel ?? ''}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">All channels</option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.title}
          </option>
        ))}
      </select>
    </div>
  );
}
