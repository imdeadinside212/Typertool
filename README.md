TYPER TOOL
================================================================

CÁCH CÀI ĐẶT

- Windows: Giải nén rồi chạy install_win.cmd (nhớ phải tắt photoshop trước, nếu bị lỗi linebreak thì install lại bằng run with administrator).
  
- macOS:  Giải nén rồi chạy install_mac.command.
  
- Mở Photoshop: Window > Extensions > Typertool.
  
- Gỡ cài đặt: uninstall_win.cmd (hoặc xóa thư mục Typertool trong folder C:/Users/TenMay/AppData/Roaming/Adobe/CEP/extensions).

-----

CHỨC NĂNG

1. Auto Line-Break
   
<img width="259" height="529" alt="image" src="https://github.com/user-attachments/assets/9a50f3fd-66c3-4765-a4a7-9dd2bc594c51" />



Chỉ cần select layer là nó sẽ tự đẻ những options đẹp nhất ở nút đầu tiên, nếu không muốn thì chọn sang các phần khác để thêm nhiều options
[Có thể tự gán phím tắt]

························

2. Tự check TR trong lúc làm việc

Tool sẽ tự scan xem có bị sai thoại gì lúc làm không.

Lấy .json của TN lúc add type, còn .json của bọn KST thì có sẵn ở mục add text trên web rồi

- Chú ý: Con KST bị ngu, code thoại trong PSD và Sfloz bị lệch tùm lum nên lúc được lúc không, đây là tính năng!

························

3. Thêm kho Effect để tự gán vào layer


<img width="259" height="293" alt="image" src="https://github.com/user-attachments/assets/ecaa445a-8771-4dd4-8302-08ac044a2705" />


Add image để tải kho pattern lên.

Chọt vào layer/folder muốn add pattern và bấm nút.

Select ảnh có sẵn trong máy, tool sẽ tự add vào (Tool dẫn link từ nguồn ảnh sang, nên không được xóa ảnh gốc).

Tự test 3 nút để tự hiểu nó tạo mask như thế nào nếu quá khó hiểu

-  Inner Mask: Tạo mask theo vùng select
  
-  Outer Mask: Tạo mask bên ngoài vùng select
  
-  Clipping mask: Tạo clipp

························

4. Copy style

<img width="259" height="171" alt="image" src="https://github.com/user-attachments/assets/9d31f7f1-1859-4989-8768-e9be5e823e39" />


Copy 1 hoặc nhiều layer theo effect của layer nằm dưới. Tool sẽ copy cả folder chứa layer nếu folder đó có effect, và cũng copy cả clipping mask/mask đen trắng nếu có.

Nếu chọn nhiều layer text thoại, mà layer gốc nằm bên dưới cũng là text thoại thì có thể tự điều chỉnh size hoặc bold/ita theo text bên dưới. Ngoài ra còn có thể căn giữa với text gốc. Có thể set size thoại gốc rồi ấn tool để tool tự tính tăng lên bao nhiêu %

- CHÚ Ý: Tool sẽ chọn layer nằm ngay dưới, nếu dính layer không có effect nằm giữa 2 layer thì sẽ bị theo layer không có effect. Để skip layer đó khóa, ẩn rồi tool sẽ chọn theo layer đúng
