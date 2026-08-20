import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { fileUrl, uploadFile } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'

/**
 * 照片选择/上传组件：逐个 POST /files/presign → PUT uploadUrl，
 * photos 保存 fileId，缩略图走 /api/files/{id}?token=。
 */
export default function PhotoPicker({ label, photos, onChange }: { label: string; photos: string[]; onChange: (v: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const ids: string[] = []
      for (const f of Array.from(files)) {
        const meta = await uploadFile(f)
        ids.push(meta.id)
      }
      onChange([...photos, ...ids])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '文件上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={uploading} onClick={() => ref.current?.click()}>
          {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
          {uploading ? '上传中…' : '拍照/上传'}
        </Button>
        <input ref={ref} type="file" accept="image/*,video/*" multiple className="hidden" disabled={uploading}
          onChange={e => { void pick(e.target.files); e.target.value = '' }} />
      </div>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {photos.map((id, i) => (
            <span key={id} className="relative inline-block">
              <img src={fileUrl(id)} alt="" className="w-14 h-14 object-cover rounded border bg-slate-100" loading="lazy" />
              <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] leading-4 text-center hover:bg-red-500">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
