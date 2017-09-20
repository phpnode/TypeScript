import * as fs from "fs";
import * as path from "path";
import * as xml2js from "xml2js";

function main(): void {
    const args = process.argv.slice(2);
    if (args.length != 3) {
        console.log("Usage:")
        console.log("\tnode generateLocalizedDiagnosticMessages.js <lcl source directory> <output directory> <generated diagnostics map file>");
        return;
    }

    const inputPath = args[0];
    const outputPath = args[1];
    const diagnosticsMapFilePath = args[2];

    // generate the lcg file for enu
    generateLCGFile();

    // generate other langs
    fs.readdir(inputPath, (err, files) => {
        handelError(err);
        files.forEach(visitDirectory);
    });

    return;

    function visitDirectory(name: string) {
        const inputFilePath = path.join(inputPath, name, "diagnosticMessages", "diagnosticMessages.generated.json.lcl");
        const outputFilePath = path.join(outputPath, name, "diagnosticMessages.generated.json");
        fs.readFile(inputFilePath, (err, data) => {
            handelError(err);
            xml2js.parseString(data.toString(), (err, result) => {
                handelError(err);
                writeFile(outputFilePath, xmlObjectToString(result));
            });
        });
    }

    function handelError(err: null | object) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    }

    function xmlObjectToString(o: any) {
        const out: any = {};
        for (const item of o["LCX"]["Item"][0]["Item"][0]["Item"]) {
            let ItemId = item["$"]["ItemId"];
            let Val = item["Str"][0]["Tgt"] ? item["Str"][0]["Tgt"][0]["Val"][0] : item["Str"][0]["Val"][0];

            if (typeof ItemId !== "string" || typeof Val !== "string") {
                console.error("Unexpected XML file structure");
                process.exit(1);
            }

            if (ItemId.charAt(0) === ";") {
                ItemId = ItemId.slice(1); // remove leading semicolon
            }

            Val = Val.replace(/]5D;/, "]"); // unescape `]`
            out[ItemId] = Val;
        }
        return JSON.stringify(out, undefined, 2);
    }


    function ensureDirectoryExists(directoryPath: string, action: () => void) {
        fs.exists(directoryPath, exists => {
            if (!exists) {
                const basePath = path.dirname(directoryPath);
                if (basePath !== directoryPath) {
                    return ensureDirectoryExists(basePath, () => fs.mkdir(directoryPath, action));
                }
            }
            action();
        });
    }

    function writeFile(fileName: string, contents: string) {
        ensureDirectoryExists(path.dirname(fileName), () => {
            fs.writeFile(fileName, contents, handelError);
        });
    }

    function objectToList(o:  Record<string, string>) {
        let list: { key: string, value: string }[] = [];
        for (const key in o) {
            list.push({ key, value: o[key] });
        }
        return list;
    }

    function generateLCGFile() {
        return fs.readFile(diagnosticsMapFilePath, (err, data) => {
            handelError(err);
            writeFile(
                path.join(outputPath, "enu", "diagnosticMessages.generated.json.lcg"),
                getLCGFileXML(
                    objectToList(JSON.parse(data.toString()))
                        .sort((a, b) => a.key > b.key ? 1 : -1)  // lcg sorted by property keys
                        .reduce((s, { key, value }) => s + getItemXML(key, value), "")
                ));
        });

        function getItemXML(key: string, value: string) {
            // escape entrt value
            value = value.replace(/]/, "]5D;");

            return `
            <Item ItemId=";${key}" ItemType="0" PsrId="306" Leaf="true">
              <Str Cat="Text">
                <Val><![CDATA[${value}]]></Val>
              </Str>
              <Disp Icon="Str" />
            </Item>`
        }

        function getLCGFileXML(items: string) {
            return `<?xml version="1.0" encoding="utf-8"?>
<LCX SchemaVersion="6.0" Name="diagnosticMessages.generated.json" PsrId="306" FileType="1" SrcCul="en-US" xmlns="http://schemas.microsoft.com/locstudio/2006/6/lcx">
  <OwnedComments>
    <Cmt Name="Dev" />
    <Cmt Name="LcxAdmin" />
    <Cmt Name="Rccx" />
  </OwnedComments>
  <Item ItemId=";String Table" ItemType="0" PsrId="306" Leaf="false">
    <Disp Icon="Expand" Expand="true" Disp="true" LocTbl="false" />
    <Item ItemId=";Strings" ItemType="0" PsrId="306" Leaf="false">
      <Disp Icon="Str" Disp="true" LocTbl="false" />${items}
    </Item>
  </Item>
</LCX>`;
        }
    }
}

main();
