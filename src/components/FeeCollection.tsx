import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  CreditCard, 
  Smartphone, 
  Printer, 
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ArrowRight,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, Transaction, OrgSettings } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import Receipt from './Receipt';

export default function FeeCollection() {
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [payment, setPayment] = useState({
    amount: '',
    payment_mode: 'UPI Digital',
    transaction_id: '',
    academic_term: ''
  });

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/students')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setStudents(data) : setStudents([]));
    
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings));
  }, []);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setError(null);

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: selectedStudent.id,
        ...payment
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.error === 'DUPLICATE_TXID') {
        setError(data.message);
      } else {
        setError('Failed to save payment. Please try again.');
      }
      return;
    }

    setLastTx({
      id: data.id || Math.floor(Math.random() * 1000),
      ...payment,
      amount: Number(payment.amount),
      student_name: selectedStudent.name,
      roll_no: selectedStudent.roll_no,
      created_at: new Date().toISOString()
    } as Transaction);

    setIsSuccess(true);
    setIsModalOpen(false);
    setPayment({ amount: '', payment_mode: 'UPI Digital', transaction_id: '', academic_term: '' });
  };

  const shareWhatsApp = () => {
    if (!lastTx || !selectedStudent) return;
    const msg = `*Fee Receipt - ${settings?.name || 'Institution'}*%0A%0AStudent: ${lastTx.student_name}%0ARoll No: ${lastTx.roll_no}%0AAmount: ₹${lastTx.amount}%0AMode: ${lastTx.payment_mode}%0ATxn ID: ${lastTx.transaction_id || 'N/A'}%0ADate: ${format(new Date(), 'dd MMM yyyy')}%0A%0AThank you for your payment!`;
    window.open(`https://wa.me/91${selectedStudent.phone}?text=${msg}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = async () => {
    const element = document.getElementById('receipt-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt_${lastTx?.id || 'Fee'}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try printing instead.');
    }
  };

  const filteredStudents = (students || []).filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {!isSuccess ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-8 bg-slate-900 text-white">
            <h3 className="text-2xl font-bold">Record Payment</h3>
            <p className="text-slate-400 text-sm mt-1">Search student and record payment details</p>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Student</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  placeholder="Search by name or roll number..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setSelectedStudent(null);
                  }}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-lg font-medium"
                />
                
                {search && !selectedStudent && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {filteredStudents.map(s => (
                      <button 
                        key={s.id}
                        onClick={() => {
                          setSelectedStudent(s);
                          setSearch(s.name);
                        }}
                        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">ROLL: {s.roll_no} • {s.branch_name}</p>
                        </div>
                        <ArrowRight size={18} className="text-slate-300" />
                      </button>
                    ))}
                    {filteredStudents.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-sm">No students found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedStudent && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Selected Student</p>
                    <p className="text-lg font-bold text-slate-900">{selectedStudent.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Dues</p>
                  <p className="text-lg font-black text-slate-900">₹{selectedStudent.plan_name ? 'Pending' : '0'}</p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700"
              >
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm font-bold">{error}</p>
              </motion.div>
            )}

            <form onSubmit={handleSavePayment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount (₹)</label>
                <input 
                  required
                  type="number"
                  value={payment.amount}
                  onChange={e => setPayment({...payment, amount: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Term</label>
                <input 
                  required
                  type="text"
                  value={payment.academic_term}
                  onChange={e => setPayment({...payment, academic_term: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="e.g. Sem I / 2024"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Mode</label>
                <select 
                  value={payment.payment_mode}
                  onChange={e => setPayment({...payment, payment_mode: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                >
                  <option>UPI Digital</option>
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transaction ID</label>
                <input 
                  required={payment.payment_mode !== 'Cash'}
                  type="text"
                  value={payment.transaction_id}
                  onChange={e => setPayment({...payment, transaction_id: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder={payment.payment_mode === 'Cash' ? 'Optional for Cash' : 'Mandatory for Digital'}
                />
              </div>

              <div className="md:col-span-2 pt-6">
                <button 
                  type="submit"
                  disabled={!selectedStudent}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CreditCard size={20} />
                  Save Payment & Generate Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-8"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden print:shadow-none print:border-none">
            <div className="p-8 bg-emerald-600 text-white text-center print:bg-white print:text-slate-900 print:border-b print:border-slate-200">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 print:hidden">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-2xl font-bold">Payment Successful</h3>
              <p className="text-emerald-100 text-sm opacity-80 print:hidden">Transaction recorded successfully</p>
            </div>

            {lastTx && <Receipt transaction={lastTx} settings={settings} />}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 print:hidden">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-lg"
            >
              <Printer size={18} />
              Print
            </button>
            <button 
              onClick={downloadPDF}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-lg"
            >
              <FileDown size={18} />
              PDF
            </button>
            <button 
              onClick={shareWhatsApp}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>
            <button 
              onClick={() => {
                setIsSuccess(false);
                setSelectedStudent(null);
                setSearch('');
              }}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
            >
              New Collection
            </button>
          </div>
        </motion.div>
      )}

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { visibility: hidden !important; background: white !important; }
          #receipt-content { 
            visibility: visible !important;
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
          }
          #receipt-content * { visibility: visible !important; }
        }
      `}} />
    </div>
  );
}
