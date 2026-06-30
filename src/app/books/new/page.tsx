'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ArrowLeft, BookPlus, Info } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createBookSchema, type CreateBookFormValues, BOOK_LIMITS } from '@/lib/validation/book-schema'
import { createZodResolver } from '@/lib/validation/zod-resolver'
import type { Book } from '@/types/book'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-400 mt-1">{message}</p>
}

export default function NewBookPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateBookFormValues>({
    resolver: createZodResolver<CreateBookFormValues>(createBookSchema),
    defaultValues: {
      citationStyle: 'ABNT',
      templateId: 'academic-classic',
      chaptersCount: 5,
      sectionsPerChapter: 4,
      paragraphsPerSection: 5,
    },
  })

  const citationStyle = watch('citationStyle')
  const templateId = watch('templateId')

  async function onSubmit(data: CreateBookFormValues) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error ?? 'Falha ao criar livro')
      }

      const { book } = await res.json() as { book: Book }
      toast.success('Livro criado com sucesso!')
      router.push(`/books/${book.$id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar livro')
    } finally {
      setSubmitting(false)
    }
  }

  const totalSections = (watch('chaptersCount') || 0) * (watch('sectionsPerChapter') || 0)
  const totalParagraphs = totalSections * (watch('paragraphsPerSection') || 0)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ButtonLink href="/books" variant="ghost" size="icon" className="text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </ButtonLink>
        <div>
          <h1 className="text-xl font-bold text-white">Novo livro</h1>
          <p className="text-slate-400 text-sm">Preencha os dados para gerar seu livro acadêmico</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Dados básicos */}
        <Card className="border-slate-700 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-white text-base">Informações do livro</CardTitle>
            <CardDescription className="text-slate-400">Dados principais que guiarão a geração</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-200">Título do livro *</Label>
              <Input
                {...register('title')}
                placeholder="Ex: Fundamentos da Inteligência Artificial na Educação"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
              <FieldError message={errors.title?.message} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-200">Descrição *</Label>
              <Textarea
                {...register('description')}
                placeholder="Descreva o tema, objetivo e público-alvo do livro..."
                rows={4}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 resize-none"
              />
              <FieldError message={errors.description?.message} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-200">Autores *</Label>
              <Input
                {...register('authors')}
                placeholder="Ex: João Silva; Maria Santos"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">Separe múltiplos autores com ponto e vírgula</p>
              <FieldError message={errors.authors?.message} />
            </div>
          </CardContent>
        </Card>

        {/* Estrutura */}
        <Card className="border-slate-700 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-white text-base">Estrutura do livro</CardTitle>
            <CardDescription className="text-slate-400">
              Defina a quantidade de capítulos e seções
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-200">
                  Capítulos *
                  <span className="text-slate-500 ml-1 font-normal text-xs">({BOOK_LIMITS.chaptersMin}–{BOOK_LIMITS.chaptersMax})</span>
                </Label>
                <Input
                  type="number"
                  min={BOOK_LIMITS.chaptersMin}
                  max={BOOK_LIMITS.chaptersMax}
                  {...register('chaptersCount', { valueAsNumber: true })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <FieldError message={errors.chaptersCount?.message} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-200">
                  Seções/cap. *
                  <span className="text-slate-500 ml-1 font-normal text-xs">({BOOK_LIMITS.sectionsMin}–{BOOK_LIMITS.sectionsMax})</span>
                </Label>
                <Input
                  type="number"
                  min={BOOK_LIMITS.sectionsMin}
                  max={BOOK_LIMITS.sectionsMax}
                  {...register('sectionsPerChapter', { valueAsNumber: true })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <FieldError message={errors.sectionsPerChapter?.message} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-200">
                  Parágrafos/seção *
                  <span className="text-slate-500 ml-1 font-normal text-xs">({BOOK_LIMITS.paragraphsMin}–{BOOK_LIMITS.paragraphsMax})</span>
                </Label>
                <Input
                  type="number"
                  min={BOOK_LIMITS.paragraphsMin}
                  max={BOOK_LIMITS.paragraphsMax}
                  {...register('paragraphsPerSection', { valueAsNumber: true })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <FieldError message={errors.paragraphsPerSection?.message} />
              </div>
            </div>

            {/* Estimativa */}
            {totalSections > 0 && (
              <div className="flex items-start gap-2 bg-blue-950/30 border border-blue-900/30 rounded-lg p-3 text-xs text-blue-300">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Estimativa:</strong> {totalSections} seções · {totalParagraphs} parágrafos no total
                  <br />
                  <span className="text-blue-400/70">Cada capítulo será gerado individualmente. Tempo estimado: {Math.ceil(watch('chaptersCount') || 1) * 2}–{Math.ceil(watch('chaptersCount') || 1) * 4} min.</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card className="border-slate-700 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-white text-base">Configurações acadêmicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-200">Estilo de citação *</Label>
                <Select
                  value={citationStyle}
                  onValueChange={(v) => setValue('citationStyle', v as CreateBookFormValues['citationStyle'])}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {['ABNT', 'APA', 'Vancouver', 'Chicago'].map((s) => (
                      <SelectItem key={s} value={s} className="text-slate-200 focus:bg-slate-700">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-200">Template visual</Label>
                <Select
                  value={templateId}
                  onValueChange={(v) => setValue('templateId', v as CreateBookFormValues['templateId'])}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="academic-classic" className="text-slate-200 focus:bg-slate-700">Clássico</SelectItem>
                    <SelectItem value="academic-modern" className="text-slate-200 focus:bg-slate-700">Moderno</SelectItem>
                    <SelectItem value="academic-minimal" className="text-slate-200 focus:bg-slate-700">Minimalista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <ButtonLink href="/books" variant="ghost" className="text-slate-400">
            Cancelar
          </ButtonLink>
          <Button type="submit" disabled={submitting} className="gap-2 min-w-[160px]">
            <BookPlus className="h-4 w-4" />
            {submitting ? 'Criando...' : 'Criar livro'}
          </Button>
        </div>
      </form>
    </div>
  )
}
