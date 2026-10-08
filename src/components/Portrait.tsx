import { useBlobUrl } from '../hooks'

interface Props {
  name: string
  image?: Blob
  /** A ready-made image URL (used for portraits received over the live view) */
  src?: string
  size?: number
}

export function Portrait({ name, image, src, size = 56 }: Props) {
  const blobUrl = useBlobUrl(image)
  const url = src ?? blobUrl
  const style = { width: size, height: size, fontSize: size * 0.45 }
  return url ? (
    <img className="portrait" src={url} alt={name} style={style} />
  ) : (
    <div className="portrait placeholder" style={style}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}
