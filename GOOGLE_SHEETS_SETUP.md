# Google Apps Script Setup for "Senarai Pautan" Automation

To enable saving data to your Google Sheet ("Share_Link" tab), please follow these steps:

1.  Open your Google Sheet: [https://docs.google.com/spreadsheets/d/14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0/edit](https://docs.google.com/spreadsheets/d/14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0/edit)
2.  Go to **Extensions** > **Apps Script**.
3.  Delete any code in `Code.gs` and paste the following code:

```javascript
function doPost(e) {
  var sheetId = "14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0";
  var sheetName = "Share_Link";
  
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Sheet 'Share_Link' not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = JSON.parse(e.postData.contents);
    
    // Append row: Date, Title, URL, Instructions, Bidang
    // Ensure the columns in your sheet match this order or adjust accordingly
    sheet.appendRow([
      new Date(), // Timestamp
      data.title,
      data.url,
      data.instructions,
      data.bidang
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ "result": "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": e.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

4.  Click **Deploy** > **New deployment**.
5.  Select type: **Web app**.
6.  Description: "S1STEN Link Saver".
7.  Execute as: **Me** (your email).
8.  Who has access: **Anyone** (Important! This allows the app to send data without login).
9.  Click **Deploy**.
10. Copy the **Web App URL**.
11. Update the `GOOGLE_SCRIPT_URL` variable in `src/App.tsx` with this URL.
