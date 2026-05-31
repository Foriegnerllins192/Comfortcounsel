# How to Fix Database Connection

## 🚨 Error: "Connection terminated due to connection timeout"

---

## ⚡ FASTEST FIX (Try This First)

### Use Your Phone's Hotspot

```
1. Enable mobile hotspot on your phone
2. Connect your computer to the hotspot
3. Open terminal in comfort-counsel folder
4. Run: npm start
5. ✅ Should work immediately!
```

**Why?** Your ISP/network is blocking database port 5432. Mobile hotspot bypasses this.

---

## 🔍 Want to Know Exactly What's Wrong?

### Run the Diagnostic Tool

```bash
cd comfort-counsel
node test-db-diagnostic.js
```

This will:
- ✅ Test your environment
- ✅ Test your connection string
- ✅ Test DNS resolution
- ✅ Test network connectivity
- ✅ Test database connection
- ✅ Tell you EXACTLY what to fix

---

## 📋 Common Fixes

| Problem | Solution |
|---------|----------|
| Network blocking port 5432 | Use mobile hotspot or VPN |
| Database is sleeping | Wake it at https://console.neon.tech/ |
| No internet | Check connection: `ping 8.8.8.8` |
| Wrong DATABASE_URL | Check `.env` file |

---

## ✅ How to Know It's Fixed

When you run `npm start`, you should see:

```
✅ Comfort Counsel server running on http://localhost:3000
ℹ Testing direct database connection...
✓ Database connected: PostgreSQL 16.x
✅ Database ready
```

---

## 📚 More Help

- **Quick Reference:** See `DATABASE_FIX_QUICK_REFERENCE.md`
- **Complete Guide:** See `DATABASE_CONNECTION_DIAGNOSTIC_GUIDE.md`
- **Full Details:** See `DATABASE_CONNECTION_FIX_COMPLETE.md`

---

## 🎯 Bottom Line

**Most likely issue:** Network blocking port 5432

**Fastest solution:** Mobile hotspot (30 seconds)

**Diagnostic tool:** `node test-db-diagnostic.js`
