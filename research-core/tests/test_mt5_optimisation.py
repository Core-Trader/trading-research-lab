from pathlib import Path

from trading_research_core.mt5_optimisation import intake_parameter_grid, intake_paired_forward_grid


def test_parameter_grid_intake_preserves_rows_and_reuses_identical_source(tmp_path: Path) -> None:
    source = tmp_path / "grid.xml"
    source.write_text('''<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office"><o:DocumentProperties><o:Title>EA EURUSD,H4</o:Title></o:DocumentProperties><Worksheet ss:Name="Tester Optimizator Results"><Table><Row><Cell><Data ss:Type="String">Pass</Data></Cell><Cell><Data ss:Type="String">Profit</Data></Cell><Cell><Data ss:Type="String">InpLot</Data></Cell></Row><Row><Cell><Data ss:Type="Number">1</Data></Cell><Cell><Data ss:Type="Number">12.5</Data></Cell><Cell><Data ss:Type="Number">0.1</Data></Cell></Row></Table></Worksheet></Workbook>''', encoding="utf-8")
    first = intake_parameter_grid(tmp_path / "workspace", str(source), "1-minute OHLC")
    second = intake_parameter_grid(tmp_path / "workspace", str(source), "1-minute OHLC")
    assert first["pass_count"] == 1
    assert first["parameter_columns"] == ["InpLot"]
    assert first["rows"][0]["Profit"] == "12.5"
    assert first["adapter"]["modelling_mode_source"] == "USER_SUPPLIED"
    assert first["intake_status"] == "SNAPSHOT_CREATED"
    assert second["intake_status"] == "REUSED_IDENTICAL_SOURCE"


def test_paired_forward_grid_requires_matching_complete_parameter_signatures(tmp_path: Path) -> None:
    template = '''<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Tester Optimizator Results"><Table><Row><Cell><Data ss:Type="String">Pass</Data></Cell><Cell><Data ss:Type="String">Profit</Data></Cell><Cell><Data ss:Type="String">InpLot</Data></Cell></Row><Row><Cell><Data ss:Type="Number">{pass_id}</Data></Cell><Cell><Data ss:Type="Number">12</Data></Cell><Cell><Data ss:Type="Number">{lot}</Data></Cell></Row></Table></Worksheet></Workbook>'''
    left, right = tmp_path / "left.xml", tmp_path / "right.xml"
    left.write_text(template.format(pass_id="1", lot="0.1"), encoding="utf-8")
    right.write_text(template.format(pass_id="99", lot="0.1"), encoding="utf-8")
    paired = intake_paired_forward_grid(tmp_path / "workspace", str(left), str(right), "2020-01-01", "2024-12-31", "2025-01-01", "2025-12-31", "1-minute OHLC")
    assert paired["pair_count"] == 1
    assert paired["rows"][0]["in_sample_pass"] == "1"
    assert paired["rows"][0]["forward_pass"] == "99"
