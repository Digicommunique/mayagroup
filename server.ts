import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

let supabase: any;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: SUPABASE_URL or SUPABASE_KEY is missing from environment variables.");
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e);
  }
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Middleware to check supabase
app.use((req, res, next) => {
  if (!supabase && req.path.startsWith('/api/') && req.path !== '/api/health') {
    return res.status(500).json({ error: "Supabase is not configured. Please check environment variables." });
  }
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", supabaseConfigured: !!(supabaseUrl && supabaseKey) });
});

// API Routes

// Settings & Setup
app.get("/api/settings", async (req, res) => {
  try {
    const { data: settings } = await supabase.from("org_settings").select("*").eq("id", 1).single();
    const { data: semesters } = await supabase.from("semesters").select("*").order("id");
    const { data: sessions } = await supabase.from("sessions").select("*").order("id");
    const { data: branches } = await supabase.from("branches").select("*").order("id");
    const { data: staff } = await supabase.from("staff").select("id, staff_id, name, password, role").order("id");
    
    res.json({ 
      settings: settings || {}, 
      semesters: semesters || [], 
      sessions: sessions || [], 
      branches: branches || [], 
      staff: staff || [] 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/settings/org", async (req, res) => {
  const { name, logo, address, phone } = req.body;
  const { error } = await supabase.from("org_settings").upsert({ id: 1, name, logo, address, phone });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post("/api/settings/semester", async (req, res) => {
  const { error } = await supabase.from("semesters").insert({ name: req.body.name });
  if (error) return res.status(400).json({ error: "Already exists or failed" });
  res.json({ success: true });
});

app.delete("/api/settings/semester/:id", async (req, res) => {
  const { error } = await supabase.from("semesters").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post("/api/settings/session", async (req, res) => {
  const { error } = await supabase.from("sessions").insert({ name: req.body.name });
  if (error) return res.status(400).json({ error: "Already exists or failed" });
  res.json({ success: true });
});

app.delete("/api/settings/session/:id", async (req, res) => {
  const { error } = await supabase.from("sessions").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post("/api/settings/branch", async (req, res) => {
  const { error } = await supabase.from("branches").insert({ name: req.body.name });
  if (error) return res.status(400).json({ error: "Already exists or failed" });
  res.json({ success: true });
});

app.delete("/api/settings/branch/:id", async (req, res) => {
  const { error } = await supabase.from("branches").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post("/api/settings/staff", async (req, res) => {
  const { staff_id, name, password } = req.body;
  const { error } = await supabase.from("staff").insert({ staff_id, name, password });
  if (error) return res.status(400).json({ error: "Staff ID already exists" });
  res.json({ success: true });
});

app.post("/api/login", async (req, res) => {
  const { staffId, password } = req.body;
  console.log(`Login attempt for: ${staffId}`);
  
  try {
    // Try to find the user
    let { data: staff, error } = await supabase
      .from("staff")
      .select("id, staff_id, name, role")
      .eq("staff_id", staffId)
      .eq("password", password)
      .maybeSingle();
    
    if (error) {
      console.error("Supabase Login Query Error:", error);
      return res.status(500).json({ error: "Database connection error", details: error.message });
    }
    
    // If no staff exists at all in the database, create the default admin
    if (!staff) {
      const { count, error: countError } = await supabase.from("staff").select("*", { count: 'exact', head: true });
      
      if (countError) {
        console.error("Supabase Count Error:", countError);
      } else if (count === 0 && staffId === 'admin' && password === '12345') {
        console.log("No staff found. Creating default admin...");
        const { data: newAdmin, error: createError } = await supabase
          .from("staff")
          .insert({ staff_id: 'admin', name: 'Administrator', password: '12345', role: 'admin' })
          .select("id, staff_id, name, role")
          .single();
        
        if (createError) {
          console.error("Supabase Create Admin Error:", createError);
          return res.status(500).json({ error: "Failed to create default admin", details: createError.message });
        }
        
        if (newAdmin) {
          return res.json({ success: true, staff: newAdmin });
        }
      }
    }
    
    if (staff) {
      res.json({ success: true, staff });
    } else {
      res.status(401).json({ error: "Invalid Staff ID or Password" });
    }
  } catch (err: any) {
    console.error("Unexpected Login Error:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

app.put("/api/settings/staff/:id", async (req, res) => {
  const { staff_id, name, password } = req.body;
  const { error } = await supabase.from("staff").update({ staff_id, name, password }).eq("id", req.params.id);
  if (error) return res.status(400).json({ error: "Staff ID already exists or update failed" });
  res.json({ success: true });
});

app.delete("/api/settings/staff/:id", async (req, res) => {
  const { data: staff } = await supabase.from("staff").select("role").eq("id", req.params.id).single();
  if (staff?.role === 'admin') {
    return res.status(400).json({ error: "Cannot delete admin" });
  }
  const { error } = await supabase.from("staff").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Fee Plans
app.get("/api/fee-plans", async (req, res) => {
  const { data: plans, error } = await supabase
    .from("fee_plans")
    .select("*, heads:fee_heads(*)");
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(plans);
});

app.post("/api/fee-plans", async (req, res) => {
  const { name, frequency, heads } = req.body;
  const total = heads.reduce((sum: number, h: any) => sum + Number(h.amount), 0);
  
  const { data: plan, error: planError } = await supabase
    .from("fee_plans")
    .insert({ name, frequency, total_amount: total })
    .select()
    .single();
    
  if (planError) return res.status(500).json({ error: planError.message });
  
  const headsToInsert = heads.map((h: any) => ({
    plan_id: plan.id,
    name: h.name,
    amount: h.amount
  }));
  
  const { error: headsError } = await supabase.from("fee_heads").insert(headsToInsert);
  if (headsError) return res.status(500).json({ error: headsError.message });
  
  res.json({ success: true, id: plan.id });
});

app.delete("/api/fee-plans/:id", async (req, res) => {
  const { error } = await supabase.from("fee_plans").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put("/api/fee-plans/:id", async (req, res) => {
  const { name, frequency, heads } = req.body;
  const total = heads.reduce((sum: number, h: any) => sum + Number(h.amount), 0);
  
  const { error: planError } = await supabase
    .from("fee_plans")
    .update({ name, frequency, total_amount: total })
    .eq("id", req.params.id);
    
  if (planError) return res.status(500).json({ error: planError.message });
  
  // Delete old heads and insert new ones
  await supabase.from("fee_heads").delete().eq("plan_id", req.params.id);
  
  const headsToInsert = heads.map((h: any) => ({
    plan_id: req.params.id,
    name: h.name,
    amount: h.amount
  }));
  
  const { error: headsError } = await supabase.from("fee_heads").insert(headsToInsert);
  if (headsError) return res.status(500).json({ error: headsError.message });
  
  res.json({ success: true });
});

// Students
app.get("/api/students", async (req, res) => {
  const { data: students, error } = await supabase
    .from("students")
    .select(`
      *,
      plan:fee_plans(name, total_amount),
      branch:branches(name),
      semester:semesters(name),
      session:sessions(name),
      transactions(amount)
    `);
    
  if (error) return res.status(500).json({ error: error.message });
  
  // Format data to match previous structure
  const formatted = students.map((s: any) => ({
    ...s,
    plan_name: s.plan?.name,
    plan_total: s.plan?.total_amount,
    branch_name: s.branch?.name,
    semester_name: s.semester?.name,
    session_name: s.session?.name,
    total_paid: s.transactions?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
  }));
  
  res.json(formatted);
});

app.post("/api/students", async (req, res) => {
  const { name, guardian_name, roll_no, phone, plan_id, branch_id, semester_id, session_id } = req.body;
  const { error } = await supabase.from("students").insert({
    name, guardian_name, roll_no, phone, plan_id, branch_id, semester_id, session_id
  });
  if (error) return res.status(400).json({ error: "Roll No already exists or failed" });
  res.json({ success: true });
});

app.get("/api/students/:id", async (req, res) => {
  const { data: student, error } = await supabase
    .from("students")
    .select(`
      *,
      plan:fee_plans(name),
      branch:branches(name),
      semester:semesters(name),
      session:sessions(name)
    `)
    .eq("id", req.params.id)
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  
  const formatted = {
    ...student,
    plan_name: student.plan?.name,
    branch_name: student.branch?.name,
    semester_name: student.semester?.name,
    session_name: student.session?.name
  };
  
  res.json(formatted);
});

app.put("/api/students/:id", async (req, res) => {
  const { name, guardian_name, roll_no, phone, plan_id, branch_id, semester_id, session_id } = req.body;
  const { error } = await supabase.from("students").update({
    name, guardian_name, roll_no, phone, plan_id, branch_id, semester_id, session_id
  }).eq("id", req.params.id);
  if (error) return res.status(400).json({ error: "Update failed" });
  res.json({ success: true });
});

app.delete("/api/students/:id", async (req, res) => {
  const { error } = await supabase.from("students").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Transactions
app.get("/api/transactions", async (req, res) => {
  const { data: txs, error } = await supabase
    .from("transactions")
    .select(`
      *,
      student:students(name, roll_no)
    `)
    .order("created_at", { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  
  const formatted = txs.map((t: any) => ({
    ...t,
    student_name: t.student?.name,
    roll_no: t.student?.roll_no
  }));
  
  res.json(formatted);
});

app.post("/api/transactions", async (req, res) => {
  const { student_id, amount, payment_mode, transaction_id, academic_term } = req.body;
  
  if (transaction_id) {
    const { data: existing } = await supabase.from("transactions").select("id").eq("transaction_id", transaction_id).single();
    if (existing) {
      return res.status(400).json({ error: "DUPLICATE_TXID", message: "This Transaction ID has already been used for a previous student." });
    }
  }

  const { error } = await supabase.from("transactions").insert({
    student_id, amount, payment_mode, transaction_id, academic_term
  });
  
  if (error) return res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  res.json({ success: true });
});

// Reports
app.get("/api/reports/summary", async (req, res) => {
  try {
    const { data: txs } = await supabase.from("transactions").select("amount");
    const { count: studentCount } = await supabase.from("students").select("*", { count: 'exact', head: true });
    const { count: planCount } = await supabase.from("fee_plans").select("*", { count: 'exact', head: true });
    
    const totalCollections = txs?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    
    const { data: recentTransactions } = await supabase
      .from("transactions")
      .select(`
        *,
        student:students(name)
      `)
      .order("created_at", { ascending: false })
      .limit(5);

    const formattedRecent = recentTransactions?.map((t: any) => ({
      ...t,
      student_name: t.student?.name
    })) || [];

    res.json({
      totalCollections,
      studentCount: studentCount || 0,
      planCount: planCount || 0,
      recentTransactions: formattedRecent
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

app.get("/api/reports/ledger", async (req, res) => {
  try {
    const { data: students, error } = await supabase
      .from("students")
      .select(`
        id,
        name,
        roll_no,
        plan:fee_plans(name, total_amount),
        transactions(amount)
      `);
      
    if (error) throw error;
    
    const ledger = students.map((s: any) => ({
      id: s.id,
      name: s.name,
      roll_no: s.roll_no,
      plan_name: s.plan?.name,
      total_due: s.plan?.total_amount || 0,
      total_paid: s.transactions?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
    }));
    
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ledger" });
  }
});

// Vite middleware
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
