import React, { useState } from 'react';
import {
  FolderPlus, Plus, Trash2, ArrowUp, ArrowDown, Edit3, Play,
  Sparkles, Clipboard, Check, X, BookOpen, AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CustomWordPack, BankWord } from '../types';
import { triggerHaptic } from '../services/telegram';
import { enrichCustomWord, parseBulkWords, CustomWordInput } from '../services/customVocab';

export const CustomPacksView: React.FC = () => {
  const { customPacks, saveCustomPack, deleteCustomPack, openLearn, packProgress } = useApp();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<CustomWordPack | null>(null);

  const handleCreate = () => {
    triggerHaptic('light');
    setEditingPack(null);
    setEditorOpen(true);
  };

  const handleEdit = (p: CustomWordPack) => {
    triggerHaptic('light');
    setEditingPack(p);
    setEditorOpen(true);
  };

  const handleDelete = (p: CustomWordPack) => {
    if (window.confirm(`"${p.title}" to'plamini o'chirmoqchimisiz?`)) {
      triggerHaptic('warning');
      deleteCustomPack(p.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Yuqori panel: Yangi to'plam qo'shish */}
      <div className="flex items-center justify-between gap-3 bg-[#151C28] border border-slate-800 p-4 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" /> Shaxsiy lug&apos;atlarim
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            50 tagacha so&apos;z qo&apos;shing — ilova avtomatik to&apos;ldirib mashqqa aylantiradi
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shrink-0 shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" /> Yangi to&apos;plam
        </button>
      </div>

      {/* To'plamlar ro'yxati yoki bo'sh holat */}
      {customPacks.length === 0 ? (
        <div className="rounded-3xl bg-[#151C28]/60 border border-slate-800/80 p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <FolderPlus className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Hozircha shaxsiy to&apos;plamingiz yo&apos;q</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
              O&apos;zingiz xohlagan 50 tagacha inglizcha so&apos;zni jadvalda kiriting. Ilova ularning tarjimasi, talaffuzi, misol gapi va mnemotexnikasini avtomatik boyitadi!
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold active:scale-95 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Birinchi to&apos;plamni yaratish
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {customPacks.map(p => {
            const pr = packProgress({
              id: p.id,
              title: p.title,
              desc: p.desc || '',
              kind: 'open',
              date: '',
              mode: 'extra',
              order: 0,
              words: p.words,
            });
            const done = pr.learned >= pr.total && pr.total > 0;

            return (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-[#151C28] border border-slate-800 space-y-3 transition-all hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white truncate">{p.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {p.words.length} ta so&apos;z
                      </span>
                    </div>
                    {p.desc && <p className="text-xs text-slate-400 mt-0.5 truncate">{p.desc}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(p)}
                      title="Tahrirlash"
                      className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      title="O'chirish"
                      className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>O&apos;zlashtirish</span>
                    <span className="font-semibold text-slate-300">
                      {pr.learned} / {pr.total} ta yodlandi
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.round((pr.learned / Math.max(1, pr.total)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Mashq qilish tugmasi */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    openLearn(p.id);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-amber-500/15"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  {done ? "Qayta takrorlash (Mustahkamlash)" : "Bugungi mashq sifatida boshlash"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 50 talik Jadval Tahrirlovchisi Modali */}
      {editorOpen && (
        <CustomPackEditorModal
          initialPack={editingPack}
          onClose={() => setEditorOpen(false)}
          onSave={(saved, startPractice) => {
            setEditorOpen(false);
            if (startPractice) {
              triggerHaptic('medium');
              openLearn(saved.id);
            }
          }}
        />
      )}
    </div>
  );
};

interface EditorModalProps {
  initialPack: CustomWordPack | null;
  onClose: () => void;
  onSave: (saved: CustomWordPack, startPractice?: boolean) => void;
}

const CustomPackEditorModal: React.FC<EditorModalProps> = ({ initialPack, onClose, onSave }) => {
  const { saveCustomPack } = useApp();
  const [title, setTitle] = useState(initialPack?.title || '');
  const [desc, setDesc] = useState(initialPack?.desc || '');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // Jadval qatorlari (1 dan 50 tagacha)
  const [rows, setRows] = useState<CustomWordInput[]>(() => {
    if (initialPack && initialPack.words.length > 0) {
      return initialPack.words.map(w => ({
        en: w.en,
        uz: w.uz,
        ipa: w.ipa,
        ex: w.ex,
        exUz: w.exUz,
        hook: w.hook,
        pos: w.pos,
      }));
    }
    // Boshlang'ich 5 ta bo'sh qator
    return Array.from({ length: 5 }, () => ({ en: '', uz: '' }));
  });

  const handleAddRow = () => {
    if (rows.length >= 50) {
      setMsg("Ko'pi bilan 50 ta so'z qo'shish mumkin");
      return;
    }
    triggerHaptic('light');
    setRows(prev => [...prev, { en: '', uz: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    triggerHaptic('light');
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    triggerHaptic('selection');
    setRows(prev => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === rows.length - 1) return;
    triggerHaptic('selection');
    setRows(prev => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleChangeRow = (index: number, field: keyof CustomWordInput, value: string) => {
    setRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Avtomatik boyitish / to'ldirish
  const handleAutoFill = () => {
    triggerHaptic('medium');
    let filledCount = 0;
    const packId = initialPack?.id || 'temp';
    const enriched = rows.map((r, i) => {
      if (!r.en.trim()) return r;
      // Agar uz yoki boshqa maydonlar bo'sh bo'lsa, avtomatik to'ldiramiz
      if (!r.uz?.trim() || !r.ipa?.trim() || !r.ex?.trim() || !r.hook?.trim()) {
        filledCount++;
      }
      const b = enrichCustomWord(r, i, packId);
      return {
        en: b.en,
        uz: r.uz?.trim() || b.uz,
        ipa: r.ipa?.trim() || b.ipa,
        ex: r.ex?.trim() || b.ex,
        exUz: r.exUz?.trim() || b.exUz,
        hook: r.hook?.trim() || b.hook,
        pos: b.pos,
      };
    });
    setRows(enriched);
    setMsg(`${filledCount} ta so'z ma'lumotlari avtomatik boyitildi ✨`);
    setTimeout(() => setMsg(null), 3500);
  };

  // Matndan tezkor yuklash (Bulk Paste)
  const handleApplyBulk = () => {
    if (!bulkText.trim()) return;
    const parsed = parseBulkWords(bulkText, 50);
    if (!parsed.length) {
      setMsg("Matnda so'zlar aniqlanmadi");
      return;
    }
    // Mavjud bo'sh qatorlarni almashtirish yoki davomidan qo'shish
    const nonEmpties = rows.filter(r => r.en.trim());
    const available = 50 - nonEmpties.length;
    const toAdd = parsed.slice(0, available);
    setRows([...nonEmpties, ...toAdd]);
    setBulkOpen(false);
    setBulkText('');
    setMsg(`${toAdd.length} ta so'z matndan yuklandi!`);
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSave = (startPractice = false) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setMsg("Iltimos, to'plamga nom bering!");
      return;
    }

    const validRows = rows.filter(r => r.en.trim());
    if (validRows.length === 0) {
      setMsg("Iltimos, kamida bitta inglizcha so'z kiriting!");
      return;
    }

    const packId = initialPack?.id || `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const words: BankWord[] = validRows.map((r, i) => enrichCustomWord(r, i, packId));

    const saved = saveCustomPack({
      id: initialPack?.id,
      title: cleanTitle,
      desc: desc.trim() || undefined,
      words,
    });

    triggerHaptic('success');
    onSave(saved, startPractice);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-hidden">
      <div className="w-full max-w-2xl bg-[#0E1524] border border-slate-800 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mx-auto">
        {/* Sarlavha paneli */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#151C28]">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              {initialPack ? "To'plamni tahrirlash" : "Yangi so'zlar to'plami (50 tagacha)"}
            </h3>
            <p className="text-[11px] text-slate-400">Jadvalga so&apos;zlarni kiriting yoki matndan nusxa oling</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Xabar bildirishnomasi */}
        {msg && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2 shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{msg}</span>
          </div>
        )}

        {/* Kontent maydoni (skroll) */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* To'plam nomi va izoh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                To&apos;plam nomi <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Masalan: IELTS Reading 1, Biznes atamalari..."
                className="w-full bg-[#151C28] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Izoh (ixtiyoriy)
              </label>
              <input
                type="text"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Qisqacha izoh..."
                className="w-full bg-[#151C28] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Tezkor amallar toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                disabled={rows.length >= 50}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" /> Qator qo&apos;shish
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen(b => !b)}
                className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
              >
                <Clipboard className="w-3.5 h-3.5" /> Matndan ko&apos;chirish
              </button>
            </div>
            <button
              type="button"
              onClick={handleAutoFill}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Avtomatik to&apos;ldirish
            </button>
          </div>

          {/* Bulk Paste Box */}
          {bulkOpen && (
            <div className="p-3.5 rounded-2xl bg-[#151C28] border border-sky-500/40 space-y-2 animate-in fade-in">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-sky-300">Matnni kiriting (har bir qatorda bittadan so&apos;z):</span>
                <button type="button" onClick={() => setBulkOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                rows={4}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"apple - olma\nbanana - banan\nachieve\ninnovative"}
                className="w-full bg-[#0E1524] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleApplyBulk}
                  className="px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs active:scale-95"
                >
                  Jadvalga joylash
                </button>
              </div>
            </div>
          )}

          {/* Jadval: ustunlar va qatorlar */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#151C28]/50">
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead className="bg-[#151C28] text-slate-300 sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 w-10 text-center text-slate-500">№</th>
                    <th className="p-2.5 w-36">Inglizcha so&apos;z *</th>
                    <th className="p-2.5 w-36">O&apos;zbekcha tarjimasi</th>
                    <th className="p-2.5 w-28">Talaffuz (IPA)</th>
                    <th className="p-2.5 w-48">Misol gap (EN)</th>
                    <th className="p-2.5 w-48">Misol tarjimasi (UZ)</th>
                    <th className="p-2.5 w-48">Mnemotexnika / Kalit</th>
                    <th className="p-2.5 w-20 text-center">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-2 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.en}
                          onChange={e => handleChangeRow(idx, 'en', e.target.value)}
                          placeholder="masalan: achieve"
                          className="w-full bg-[#0E1524] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.uz || ''}
                          onChange={e => handleChangeRow(idx, 'uz', e.target.value)}
                          placeholder="erishmoq (yoki avto)"
                          className="w-full bg-[#0E1524] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.ipa || ''}
                          onChange={e => handleChangeRow(idx, 'ipa', e.target.value)}
                          placeholder="/əˈtʃiːv/"
                          className="w-full bg-[#0E1524] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.ex || ''}
                          onChange={e => handleChangeRow(idx, 'ex', e.target.value)}
                          placeholder="She achieved her goal."
                          className="w-full bg-[#0E1524] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.exUz || ''}
                          onChange={e => handleChangeRow(idx, 'exUz', e.target.value)}
                          placeholder="U o'z maqsadiga erishdi."
                          className="w-full bg-[#0E1524] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.hook || ''}
                          onChange={e => handleChangeRow(idx, 'hook', e.target.value)}
                          placeholder="💡 Eslab qolish kaliti..."
                          className="w-full bg-[#0E1524] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-amber-200/90 focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            title="Yuqoriga surish"
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === rows.length - 1}
                            title="Pastga surish"
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            title="Qatorni o'chirish"
                            className="p-1 rounded text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 bg-[#151C28] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                To&apos;ldirilgan so&apos;zlar: <b className="text-white">{rows.filter(r => r.en.trim()).length}</b> / 50 ta
              </span>
              <button
                type="button"
                onClick={handleAddRow}
                disabled={rows.length >= 50}
                className="text-amber-400 font-bold hover:underline disabled:opacity-30"
              >
                + Yana qator qo&apos;shish
              </button>
            </div>
          </div>
        </div>

        {/* Pastki saqlash tugmalari */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#151C28] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold active:scale-95 transition-all text-center"
          >
            Bekor qilish
          </button>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold active:scale-95 transition-all"
            >
              Saqlash
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
            >
              <Play className="w-4 h-4 fill-slate-950" /> Saqlash va Mashq qilish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
