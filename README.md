TYPER TOOL
================================================================

CÁCH CÀI ĐẶT

- Windows: Giải nén rồi chạy install_win.cmd (nhớ phải tắt photoshop trước).
  
- macOS:  Giải nén rồi chạy install_mac.command.
  
- Mở Photoshop: Window > Extensions > Typertool.
  
- Gỡ cài đặt: uninstall_win.cmd (hoặc xóa thư mục TypeRLite trong folder Adobe/CEP/extensions).

-----

CHỨC NĂNG

1. Auto Line-Break
   
<img width="259" height="381" alt="image" src="https://github.com/user-attachments/assets/5118ff2f-e7b8-45a4-bff5-a742c3296c09" />


Chỉ cần select layer là nó sẽ tự đẻ những options đẹp nhất ở nút đầu tiên, nếu không muốn thì chọn sang các phần khác để thêm nhiều options
[Có thể tự gán phím tắt]

························

2. Thêm kho Effect để tự gán vào layer
<img width="259" height="374" alt="image" src="https://github.com/user-attachments/assets/f1b2b15a-45d9-4caf-a183-601393f007bb" />


Add image để tải kho pattern lên.

Chọt vào layer/folder muốn add pattern và bấm nút.

Select ảnh có sẵn trong máy, tool sẽ tự add vào (Tool dẫn link từ nguồn ảnh sang, nên không được xóa ảnh gốc).

Tự test 3 nút để tự hiểu nó tạo mask như thế nào nếu quá khó hiểu

-  Inner Mask: Tạo mask theo vùng select
  
-  Outer Mask: Tạo mask bên ngoài vùng select
  
-  Clipping mask: Tạo clipp

························

3. Copy style
<img width="259" height="173" alt="image" src="https://github.com/user-attachments/assets/06e3c141-6bb3-4b7a-9f59-b67b7bbd8e01" />

Copy 1 hoặc nhiều layer theo effect của layer nằm dưới. Tool sẽ copy cả folder chứa layer nếu folder đó có effect, và cũng copy cả clipping mask.

Nếu chọn nhiều layer text thoại, mà layer gốc nằm bên dưới cũng là text thoại thì có thể tự điều chỉnh size hoặc bold/ita theo text bên dưới. Ngoài ra còn có thể căn giữa với text gốc. 

- CHÚ Ý: Tool sẽ chọn layer nằm ngay dưới, nếu dính layer không có effect nằm giữa 2 layer thì sẽ bị theo layer không có effect. Để skip layer đó khóa, ẩn rồi tool sẽ chọn theo layer đúng
