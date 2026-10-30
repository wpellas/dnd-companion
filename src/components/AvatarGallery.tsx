import { X } from 'lucide-react'
import { t } from '../lib/i18n'
import { Portrait } from './Portrait'

/** An entry's pictures as small thumbnails with a remove button each, and a picker that adds more (several files at once are fine). */
export function AvatarGallery({ name, images, onAdd, onRemove }: { name: string; images: Blob[]; onAdd: (files: File[]) => void; onRemove: (index: number) => void }) {
  return (
    <div className="avatar-gallery">
      {images.map((img, i) => (
        <span key={i} className="avatar-thumb">
          <Portrait name={name} image={img} size={56} />
          <button title={t('avatar.remove')} aria-label={t('avatar.remove')} onClick={() => onRemove(i)}>
            <X />
          </button>
        </span>
      ))}
      <label className="file-button" title={t('avatar.addTitle')}>
        {t('avatar.add')}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) onAdd(files)
          }}
        />
      </label>
    </div>
  )
}
