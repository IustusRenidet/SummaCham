var xlsx = require("xlsx")
var fs = require('fs')
var dataPathExcelToRead = "SUMMARY EMPRESA01_2022.xlsx"
var wb = xlsx.readFile(dataPathExcelToRead)
var sheetName = wb.SheetNames[0]
var sheetValue = wb.Sheets[sheetName]
var htmlData = xlsx.utils.sheet_to_html(sheetValue);
//console.log(htmlData)
fs.writeFile('excelReadFileToHtml.html',htmlData,function(err){
    console.log("Data is saved Yippeeeeeee")
})