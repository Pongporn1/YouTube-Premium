# คู่มือติดตั้ง MyTube (ฉบับละเอียด)

MyTube มี 2 แอปใน repo เดียวกัน:

| แอป | ไฟล์ | ใช้ทำอะไร |
|---|---|---|
| **MyTube** (`MyTube.exe`) | `artifacts/publish/win-x64/` | เบราว์เซอร์ YouTube จริงบน Windows พร้อมบล็อกโฆษณา, mini player ลอยด้านบนเสมอ (ลากย้ายได้), หน้าต่าง MyTube Music แยก, ปุ่มสื่อ Windows |
| **MyTubeMusic** (`MyTubeMusic.exe`) | `artifacts/publish/music-x64/` | แอปเพลงเบาพิเศษสำหรับเล่นเกม FPS — ปิด GPU, priority ต่ำกว่าปกติ (เกมได้ CPU ก่อนเสมอ), ลอยด้านบนเสมอ, ปุ่มสื่อในตัว, บล็อกโฆษณาครบ |

ทั้งสองแอป**ไม่มีค่าใช้จ่าย ไม่มีการเก็บข้อมูล ไม่มี telemetry**

---

## 1) สิ่งที่เครื่องต้องมีก่อนติดตั้ง

1. **Windows 10 (เวอร์ชัน 1809 ขึ้นไป) หรือ Windows 11** แบบ 64-bit
2. **.NET 8 Desktop Runtime (x64)** — โหลดที่ <https://dotnet.microsoft.com/download/dotnet/8.0> เลือก "Desktop Runtime" แบบ x64
3. **Microsoft Edge WebView2 Runtime** — Windows 11 มีให้แล้ว ถ้าเครื่องไม่มี โหลดที่ <https://developer.microsoft.com/microsoft-edge/webview2/> (เลือก Evergreen Standalone x64)
4. อินเทอร์เน็ต และ**บัญชี Google ที่เจ้าของอนุญาต** (MyTube จำกัดการเข้าถึงด้วย allowlist — บัญชีอื่นล็อกอินไม่ได้)
5. ตรวจว่าติดตั้งถูกต้อง: เปิด PowerShell แล้วพิมพ์ `dotnet --list-runtimes` ต้องเห็นบรรทัด `Microsoft.WindowsDesktop.App 8.x.x`

---

## 2) วิธีติดตั้งแบบใช้ build สำเร็จรูป (ง่ายสุด)

ถ้าคุณได้โฟลเดอร์ `artifacts/publish/` มาพร้อม repo (หรือ build ไว้แล้ว):

1. คัดลอกโฟลเดอร์ **ทั้งโฟลเดอร์** (อย่า copy ตัว .exe โดด ๆ):
   - `artifacts\publish\win-x64\` → สำหรับ **MyTube.exe**
   - `artifacts\publish\music-x64\` → สำหรับ **MyTubeMusic.exe**
   ไปวางไว้ที่ถาวร เช่น `C:\Program Files\MyTube\` หรือ `C:\Tools\MyTube\`
2. คลิกขวาที่ `MyTube.exe` → **ส่งไปที่ → Desktop (สร้างทางลัด)** — ทำเช่นกันกับ `MyTubeMusic.exe` (หรือใช้ shortcut "MyTube Music" ที่ setup สร้างไว้แล้ว)
3. เปิดผ่าน shortcut — เสร็จ ไปที่หัวข้อ 4 (การล็อกอินครั้งแรก)

> ห้ามย้าย/ลบไฟล์รอบ ๆ .exe (โดยเฉพาะ `Resources\` และ `WebView2Loader.dll`) เพราะแอปโหลดตัวกรองโฆษณาจากโฟลเดอร์เดียวกัน

---

## 3) วิธี build จากซอร์สโค้ดเอง

### เตรียมเครื่อง
1. ติดตั้ง **.NET 8 SDK** (<https://dotnet.microsoft.com/download/dotnet/8.0> — ตัว SDK ไม่ใช่ Runtime)
2. เปิด PowerShell ในโฟลเดอร์ repo

### build และทดสอบ
```powershell
dotnet restore MyTube.sln
dotnet build MyTube.sln
dotnet test MyTube.sln          # ต้องผ่าน 33/33
```

### publish แอปหลัก (MyTube.exe)
```powershell
dotnet publish src/MyTube/MyTube.csproj -c Release -r win-x64 --self-contained false -o artifacts/publish/win-x64
```

### publish แอปเพลง (MyTubeMusic.exe)
```powershell
dotnet publish src/MyTubeMusic/MyTubeMusic.csproj -c Release -r win-x64 --self-contained false -o artifacts/publish/music-x64
```

> เครื่องที่ไม่มี SDK ระบบ ใช้ SDK แบบพกพาได้: โหลด `https://dot.net/v1/dotnet-install.ps1` แล้วรัน `-Channel 8.0 -InstallDir artifacts/.dotnet-sdk` จากนั้นเรียก `artifacts\.dotnet-sdk\dotnet.exe` แทน `dotnet`

### อัปเดตเวอร์ชันใหม่ทีหลัง
```powershell
git pull
# ปิด MyTube/MyTubeMusic ที่กำลังเปิดอยู่ก่อน แล้ว publish ซ้ำตามคำสั่งด้านบน
```

---

## 4) การล็อกอินครั้งแรก (สำคัญ — ทำครั้งเดียวต่อแอป)

### MyTube.exe (หน้าหลัก)
1. เปิดแอป → กด **เข้าสู่ระบบด้วย Google** ด้วยบัญชีที่อยู่ใน allowlist
2. กดปุ่ม **"เชื่อม YouTube"** → หน้าขอสิทธิ์ของ Google จะเด้งขึ้น → **Advanced → Go to MyTube Private (unsafe) → Allow**
   (คำเตือน "unverified app" ปกติของแอปส่วนตัว — ปลอดภัยเพราะเป็นแอปของเราเอง)
3. กลับมาแล้วจะขึ้น "เชื่อมข้อมูล YouTube แล้ว — ครั้งต่อไประบบจะต่อสิทธิ์ให้เอง"
4. **จบ** — ครั้งต่อไปเปิดแอประบบต่อสิทธิ์เอง ไม่ต้องกดอีก

### MyTubeMusic.exe (แอปเพลง)
1. เปิดแอป → **ล็อกอิน Google หนึ่งครั้ง** (แอปนี้มีโปรไฟล์แยกของตัวเอง)
2. หน้า Music โหลดเสร็จ = พร้อมใช้ — เลือกเพลย์ลิสต์/เพลงได้เลย
3. กด **Ctrl+Shift+M บนแอปหลัก** เพื่อ mini player หรือลากหน้าต่าง Music ไปมุมจอคู่กับเกม

### ปุ่มสื่อของ Windows
เมื่อมีเสียงเล่นอยู่ กดปุ่ม play/pause/next บนคีย์บอร์ด หรือดูแผงควบคุมบนหน้าจอล็อก/volume flyout ได้ทันที ระบบจะควบคุม "ฝั่งที่กำลังเล่น" ให้เอง

---

## 5) คีย์ลัดทั้งหมด

| คีย์ | ทำอะไร |
|---|---|
| `Alt+←` / `Alt+→` | ย้อนกลับ / ไปข้างหน้า |
| `Ctrl+R` | โหลดหน้าใหม่ |
| `Ctrl+Shift+F` | Focus Mode (ซ่อนสิ่งรบกวน) |
| `Ctrl+Shift+M` | mini player ลอยด้านบนเสมอ (กดซ้ำ = ออก) |
| `F11` | เต็มจอ |
| `Esc` | ออกจากเต็มจอ / mini player |
| ปุ่มสื่อบนคีย์บอร์ด | play/pause/next/previous ควบคุมฝั่งที่กำลังเล่น |

---

## 6) ระบบบล็อกโฆษณาทำงานอย่างไร (ไม่ต้องตั้งค่าอะไร)

- **3 ชั้นอัตโนมัติ**: ซ่อนโฆษณาหน้าเว็บด้วย CSS, ปราบโฆษณาใน player (mute + ข้ามทันที + ตัดข้อมูลตารางโฆษณาก่อน player อ่าน), บล็อก network ของ ad/tracker
- โฆษณาแบบผสมใน stream โดยตรง (บางไลฟ์/Music ชั้นฟรี) ตัดได้บางส่วนเท่านั้น — ข้อจำกัดของทุกเครื่องมือ
- แอปไม่ bypass DRM, ไม่โหลดวิดีโอ, ไม่เก็บข้อมูลส่งออกนอกเครื่อง

---

## 7) แก้ปัญหาเบื้องต้น

| อาการ | วิธีแก้ |
|---|---|
| เปิดไม่ขึ้น บอก WebView2 | ติดตั้ง WebView2 Runtime ตามลิงก์ข้อ 1-3 แล้วเปิดใหม่ |
| `dotnet` ไม่รู้จัก | ยังไม่ได้ติดตั้ง .NET 8 (แอปใช้ Runtime ตอนเปิด, SDK ตอน build) |
| ล็อกอินไม่ได้ บอกว่าบัญชีไม่ได้รับอนุญาต | บัญชีนั้นไม่อยู่ใน allowlist ของเจ้าของ — ขอให้เจ้าของเพิ่ม |
| เชื่อม YouTube แล้วเด้ง unverified app | กด Advanced → Go to MyTube Private (unsafe) → Allow (ปกติของแอปส่วนตัว) |
| เพลงกระตุกตอนเล่นเกม | ปกติ priority ต่ำจะยก CPU ให้เกมก่อน — ถ้าเกมกิน CPU 100% เพลงอาจสะดุดบ้างเล็กน้อย (ตั้งใจไว้) |
| อยากล้างข้อมูลแอป | ลบโฟลเดอร์ `%LOCALAPPDATA%\MyTube` (หลัก) หรือ `%LOCALAPPDATA%\MyTubeMusic` (แอปเพลง) |

---

## 8) ความเป็นส่วนตัว

- ประวัติ/watch later ของเว็บอยู่ในเครื่องเท่านั้น; แอป Windows ใช้ session ของ YouTube จริงในโฟลเดอร์แยก
- ไม่มี telemetry, ไม่มี database, log ที่เก็บเป็นแค่เหตุการณ์ทำงาน (ไม่มี cookie/รหัสผ่าน)
- โค้ดเปิดให้ตรวจได้ทั้งหมดใน repo นี้
