import { Field, FieldDescription } from "./ui/field"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"

export default function CaptionPanel({
  caption,
  prefix,
  onCaptionChange,
  onPrefixChange,
}: {
  caption: string | undefined,
  prefix: string,
  onCaptionChange: (val: string) => void,
  onPrefixChange: (val: string) => void,
}) {
  return (
    <div className='w-full h-full flex flex-col p-4 gap-4'>
      <Field>
        <FieldDescription>
          Prefix
        </FieldDescription>
        <Input value={prefix} onChange={e => onPrefixChange(e.target.value)} />
      </Field>
      <Field>
        <FieldDescription>
          Caption
        </FieldDescription>
        <Textarea
          className='w-2xl'
          placeholder='Caption'
          disabled={caption === undefined}
          value={caption ?? ''}
          onChange={e => onCaptionChange(e.target.value)}
        />
      </Field>
    </div>
  )
}