TYPERTOOL - Ngat dong + Image mask + Copy style trong 1 panel
================================================================

CAI DAT
  Windows: giai nen ca file zip, chay install_win.cmd (tat Photoshop truoc).
  macOS:   giai nen, chay install_mac.command (chuot phai > Open neu bi chan).
  Mo Photoshop: Window > Extensions > Typertool.
  Go cai dat: uninstall_win.cmd (hoac xoa thu muc Typertool trong Adobe/CEP/extensions).

1. NGAT DONG (khung tren cung)
  - Chon 1 layer chu (point text). Chon so dong thi HIEN HET moi option cua so dong do cung luc (khong co
    mui ten chuyen trang; keo thanh giua cac khung neu can khung cao hon).
  - OPTION DAU TIEN cua moi so dong (va cua nut Dep nhat) la ket qua cua bo script Line Breaker:
    hinh kim cuong (1,2,3,2,1...), cung ham chi phi, cung thuat toan toi uu va cung buoc don dep cuoi
    (dong dau >= 2 ky tu, khong de dau cau dung rieng, khong de dong bat dau bang 0/00/000).
    Nut Dep nhat dung dung so dong ma script chon theo tong so tu. Cac option tiep theo la nhung cach ngat
    gan nhat (dich 1-2 tu) va cac cach ngat tron nhat tim bang quy hoach dong.
  - Bam 1 option: CHI doi cho ngat dong (ghi noi dung chu), kich thuoc / font / mau / stroke giu nguyen hoan toan.
  - AUTO CENTER (nut o tren): bat thi khi BAM option
      * dang co duong select (magic wand): chu duoc dat vao TAM KHUNG cua vung select. Khong quet vien, khong tinh
        duoi nhon nen rat nhanh. Vung select dung yen;
      * khong co vung select: chu giu nguyen tam hien tai.
  - NHANH HON / KHONG LAM PHOTOSHOP CHAM: bam option chay 1 lenh duy nhat trong Photoshop (viet chu + dat vi tri),
    chi tao 1 history "TyperTools Change" (Ctrl+Z 1 lan la quay lai). Panel KHONG hoi Photoshop lien tuc:
    no chi doc layer / vung select khi ban re chuot vao panel, khi panel duoc focus, hoac khi bam phim tat.
    Luc ban chinh layer effect, dung canvas... panel khong lam gi ca.
    Neu ban doi layer trong Photoshop roi bam option ma chua re chuot ra vao panel, Photoshop tu choi ghi de
    (layer da doi) va panel doc lai: chi can bam lai.
  - PHIM TAT: CO SAN, KHONG CAN CAI GI THEM. Mac dinh ALT+1..ALT+9 = 1..9 dong, ALT+0 = Dep nhat.
    Bam phim (khi Photoshop dang la cua so chinh): panel nhay thang sang nut so dong do (sang xanh) va dung ngay
    option dau tien cho layer chu dang chon. Doi phim: nut "Cai dat" (Settings) o thanh tren cung > tab "Phim tat" > Gan > nhan to hop phim.
    Cach hoat dong: panel mo 1 tien trinh nho (keys\typertool-keys.ps1 + KeyWatcher.cs, chay bang PowerShell,
    chi Windows) chi doc cac phim tat va bao khi co phim duoc bam. Panel KHONG hoi Photoshop nen khong lam giat.
    Trang thai hien trong tab "Phim tat" (xanh = dang chay). Neu bi do (Mac, hoac phan mem diet virus chan PowerShell):
    dung cach du phong - install_win.cmd da chep 16 script "Typertool - Best", "Typertool - 1 line"... vao
    Photoshop\Presets\Scripts (can Run as administrator; neu khong, chep tay thu muc Scripts vao do); khoi dong lai
    Photoshop, vao Edit > Keyboard Shortcuts > Application Menus > File > Scripts va gan phim cho tung script.
  - KHONG BI LAN VOI PHIM TAT CUA PHOTOSHOP: cac phim tat cua tool bi CHAN khong cho Photoshop nhan (chi khi Photoshop
    dang la cua so chinh, va chi dung to hop phim da gan). Vd gan Shift+F2 cho "2 dong" thi Shift+F2 khong kich hoat
    them gi cua Photoshop, con F2 thuong (vd paste effect) van chay binh thuong. Luu y: phim tat nao cua Photoshop
    trung dung to hop phim cua tool thi se khong chay duoc khi tool dang mo. Tat chan: Cai dat > tab "Phim tat" > bo tick
    "Chan cac phim nay khoi Photoshop" (dung neu phan mem diet virus bao tien trinh nghe phim). Dong trang thai
    trong tab "Phim tat" cho biet Photoshop co con nhan cac phim do khong. Giu phim modifier truoc roi moi bam phim chinh
    (vd giu Shift roi bam F2); bam F2 truoc roi moi giu Shift thi Photoshop da nhan F2 roi.
  - MENU CO DINH: khi keo xuong xem cac option, nut Auto center va day nut so dong luon nam o tren cung.

CAI DAT (nut "Cai dat" / Settings o thanh tren cung): 2 tab
  - Tab "Phim tat": nhu cu.
  - Tab "Bo cuc giao dien": moi khung la 1 the nho co ten khung, nut con mat (goc tren ben phai) va 2 nut Len / Xuong.
      * Len / Xuong: doi vi tri khung (khung dau khong co Len, khung cuoi khong co Xuong). Kich thuoc va trang thai
        thu gon cua tung khung di theo khung do.
      * Con mat: AN HAN khung (mat ca thanh tieu de / dong thu gon) va TAT luon: khung khong chay gi cho toi khi ban
        bam con mat de hien lai (vd an khung Ngat dong thi phim tat cung ngung). Thu tu va trang thai an duoc nho.
        An het tat ca thi hien dong nhac vao Cai dat de hien lai.

THU GON TUNG KHUNG
  - Moi khung co nut mui ten o goc tren ben phai. Bam de thu gon / mo ra. Khung dang thu gon KHONG hoat dong
    (khong nghe phim tat, khong doc Photoshop...). Trang thai duoc nho cho lan mo sau.

KEO DE DOI KICH THUOC 3 KHUNG
  - Giua 3 khung co 2 thanh ngang: giu chuot keo len/xuong de doi chieu cao khung tren va khung duoi.
    Bam dup vao thanh de dat lai kich thuoc mac dinh. Kich thuoc duoc nho cho lan mo sau.

1b. CHECK TYPE (panel between Line break and Image mask)
  - "Add .json": pick the script (.json exported by the translation tool, or a text file with
    lines like "1_ text"). Every text of the file becomes one line of the list, numbered with its code.
  - The open Photoshop file is scanned ONCE. A layer belongs to a line when its NAME starts with the
    same code ("1_", "DKI: 1_"). A line turns RED when the text of its layer is not the text of the
    script: other words, or a line break that cuts a word / a hyphen at the end of a line.
    A break between two words is fine. A line with no layer is dimmed.
  - The list is ordered by place on the page: texts that sit close to each other are listed together
    (top to bottom, left to right inside the same band).
  - Nothing runs in the background. Photoshop is only asked when the pointer enters the panel, when the
    panel gets the focus, or when you press Rescan: if another file came to the front it is scanned once,
    otherwise only the layer you changed is read again and only its line is updated.

2. IMAGE MASK (khung giua) - giu nguyen nhu ban TypeR
  - Them anh PNG/JPG (hoac keo tha vao khung). Chon 1 anh trong danh sach.
  - Danh sach anh hien 2 anh tren 1 dong.
  - Mask trong / Mask ngoai (hoac Alt+bam Mask trong) / Clipping mask cho layer dang chon.

3. COPY STYLE (khung duoi)
  - Nhu panel Copy Style cu: nut Copy effect + 3 cong tac Bold/Italic, Size, Auto center.
  - Size: khi Size bat, neu B zoom tu +1% den +30% so voi moc thi A zoom them 10% nua
    (vd B +1% thi A +11%, B +20% thi A +30%); ngoai khoang do khong cong them.
    CHI PHONG TO: B bang hoac nho hon moc thi A giu nguyen, khong bao gio thu nho.
  - O Sp / Nar: nhap tay size GOC cua layer B. Bam nut Sp hoac Nar (xanh = dang chon, chi 1 o duoc chon,
    o con lai bi bo qua); size A tinh tang len tu so do. Bam lai nut dang chon de bo chon -> tool tu thong ke size goc nhu cu.

LUU Y
  - Can Photoshop CC 2015 tro len. Panel chua ky so nen installer bat PlayerDebugMode.
  - Neu dang cai TypeR: dung hai panel cung luc duoc, nhung dung gan cung phim tat.
