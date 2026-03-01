/**
 * GOOGLE APPS SCRIPT FOR PANITIA UPLOAD
 * 
 * Instructions:
 * 1. Open Google Sheets: https://docs.google.com/spreadsheets/d/1eE4WGugWlSMyuPYv12vhW9jDm_AKcBVHCFBVp5DSBhQ/edit
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any existing code and paste this code.
 * 4. Click "Deploy" > "New Deployment".
 * 5. Select "Web App".
 * 6. Set "Execute as" to "Me" and "Who has access" to "Anyone".
 * 7. Click "Deploy" and copy the Web App URL.
 * 8. Paste the URL into your .env file as VITE_GAS_PANITIA_URL.
 */

function doPost(e) {
  var result = {
    success: false,
    message: "Unknown error"
  };
  
  try {
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    
    var filename = data.filename || "Untitled";
    var mimeType = data.mimeType || "application/octet-stream";
    var base64Data = data.data;
    var panitia = data.panitia || "Umum";
    var namaGuru = data.namaGuru || "Guru";
    var parentFolderId = data.folderId;
    var sheetId = data.sheetId;

    if (!base64Data) throw new Error("Tiada data fail diterima.");
    if (!parentFolderId) throw new Error("Folder ID tidak sah.");
    if (!sheetId) throw new Error("Sheet ID tidak sah.");

    // 1. Handle Drive Upload
    var parentFolder = DriveApp.getFolderById(parentFolderId);
    var subFolders = parentFolder.getFoldersByName(panitia);
    var targetFolder;
    
    if (subFolders.hasNext()) {
      targetFolder = subFolders.next();
    } else {
      targetFolder = parentFolder.createFolder(panitia);
    }

    var decodedData = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedData, mimeType, filename);
    var file = targetFolder.createFile(blob);
    
    // Set permissions so anyone with the link can view
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      console.warn("Gagal set sharing permission: " + e.toString());
    }
    
    var fileUrl = file.getUrl();

    // 2. Handle Sheet Logging
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName("Bahan_Panitia");
    
    if (!sheet) {
      sheet = ss.insertSheet("Bahan_Panitia");
      sheet.appendRow(["TIMESTAMP", "NAMA PANITIA", "NAMA GURU", "NAMA FAIL", "LINK URL"]);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#f3f3f3");
    }

    var timestamp = new Date();
    sheet.appendRow([timestamp, panitia, namaGuru, filename, fileUrl]);

    result.success = true;
    result.url = fileUrl;
    result.message = "Berjaya dimuat naik ke " + panitia;

  } catch (error) {
    result.success = false;
    result.message = error.toString();
    console.error("GAS Error: " + error.toString());
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
