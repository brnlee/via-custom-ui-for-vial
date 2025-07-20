import {
  Button,
  Checkbox,
  FormControl,
  Grid,
  Input,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Slider,
  Switch,
} from "@mui/material";
import { MuiColorInput, MuiColorInputColors } from "mui-color-input";
import { ChangeEvent, SyntheticEvent } from "react";
import evaluate from "simple-evaluate";

interface MenuItemProperties {
  label: string;
  content: MenuSectionProperties[];
}

type ToggleElement = {
  type: "toggle";
  label: string;
  options?: [number, number];
  content: [string, number, number, number?];
  value?: number;
  onChange: (value: number) => void;
};

type RangeElement = {
  type: "range";
  label: string;
  options?: [number, number];
  content: [string, number, number, number?];
  value: number;
  onChange: (value: number) => void;
};

type DropdownElement = {
  type: "dropdown";
  label: string;
  content: [string, number, number, number?];
  options: Array<[string, number]> | Array<string>;
  value: number;
  onChange: (value: number) => void;
};

type ColorElement = {
  type: "color";
  label: string;
  content: [string, number, number, number?];
  value: number;
  onChange: (value: number) => void;
};

type ButtonElement = {
  type: "button";
  label: string;
  content: [string, number, number, number?];
  options?: Array<number>;
  value: number;
  onChange: (value: number) => void;
};

type MultipleCheckboxElement = {
  type: "multiple-checkbox";
  label: string;
  content: [string, number, number, number?];
  options: Array<[string, number]> | Array<string>;
  value: number;
  onChange: (value: number) => void;
};

type ShowIfElement =
  | {
    showIf: string;
    content: MenuElementProperties[];
  }
  | (MenuElementProperties & { showIf: string });

type MenuElementProperties =
  | RangeElement
  | DropdownElement
  | ColorElement
  | ToggleElement
  | ButtonElement
  | MultipleCheckboxElement;

type MenuSectionProperties = {
  label: string;
  content: (MenuElementProperties | ShowIfElement)[];
  customValues: { [id: string]: number };
  onChange: (id: [string, number, number, number?], value: number) => void;
};

function ViaToggle(props: ToggleElement) {
  const handleChange = (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    props.onChange(checked ? (props.options?.[1] ?? 1) : (props.options?.[0] ?? 0));
  };
  return (
    <>
      <Grid item xs={3}>
        <h4>{props.label}</h4>
      </Grid>
      <Grid item xs={9}>
        <Switch onChange={handleChange} checked={props.value == (props.options?.[1] ?? 1)}></Switch>
      </Grid>
    </>
  );
}
function ViaRange(props: RangeElement) {
  const crop = (val: number) => {
    if (((props.options?.[1] ?? 255) < val && props.options?.[1]) ?? 0 < 0) {
      return val - 256;
    }

    return val;
  };
  const handleChange = (_event: Event, value: number | number[]) => {
    if (!Array.isArray(value)) {
      props.onChange(value);
    }
  };
  const handleChangeCommitted = (_event: SyntheticEvent | Event, value: number | number[]) => {
    if (!Array.isArray(value)) {
      props.onChange(value);
    }
  };
  const handleChangeInput = (event: ChangeEvent<HTMLInputElement>) => {
    const max = props.options?.[1] ?? 255;
    const min = props.options?.[0] ?? 0;
    const value = Math.min(
      max,
      Math.max(min, Number(event.target.value === "" ? 0 : event.target.value)),
    );
    props.onChange(value);
  };

  return (
    <>
      <Grid item xs={3}>
        <h4>{props.label}</h4>
      </Grid>
      <Grid item xs={8}>
        <Slider
          value={crop(props.value)}
          onChange={handleChange}
          onChangeCommitted={handleChangeCommitted}
          min={props.options?.[0] ?? 0}
          max={props.options?.[1] ?? 255}
          valueLabelDisplay="auto"
        ></Slider>
      </Grid>
      <Grid item xs={1}>
        <Input
          value={crop(props.value)}
          onChange={handleChangeInput}
          inputProps={{ type: "number" }}
        ></Input>
      </Grid>
    </>
  );
}

function getDropDownLabels(elem: DropdownElement | MultipleCheckboxElement): [string, number][] {
  return elem.options.map((o, index) => {
    if (Array.isArray(o)) {
      return [o[0], o[1]];
    } else {
      return [o, index];
    }
  });
}

function ViaDropDown(props: DropdownElement) {
  const handleChange = (event: SelectChangeEvent) => {
    props.onChange(getDropDownLabels(props).find((f) => f[0] === event.target.value)?.[1] ?? 0);
  };
  return (
    <>
      <Grid item xs={3}>
        <h4>{props.label}</h4>
      </Grid>
      <Grid item xs={9}>
        <FormControl fullWidth>
          <Select
            value={getDropDownLabels(props).find((f) => f[1] === props.value)?.[0] ?? ""}
            onChange={handleChange}
          >
            {getDropDownLabels(props).map((o) => {
              return (
                <MenuItem key={`${props.label}-${o[0]}`} value={o[0]}>
                  {o[0]}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Grid>
    </>
  );
}

function ViaColor(props: ColorElement) {
  /**
   * "Packing" Logic: Called when the user picks a new color.
   * It packs H and S into a single integer with H in the low byte and S in the high byte,
   * matching the byte order the C firmware expects.
   */
  const handleChange = (_: string, color: MuiColorInputColors) => {
    console.log(`Color changed: ${color.hsv}`);

    // Regex to parse "hsv(H, S%, V%)"
    const hsvRegex = /hsv\((\d+),\s*(\d+)%/;
    const match = color.hsv.match(hsvRegex);

    if (match && match.length === 3) {
      // Convert captured strings to integers.
      // We must scale Hue from 0-360 to 0-255 to fit in a byte.
      // Saturation from 0-100 to 0-255.
      console.log(`Parsed HSV: H=${match[1]}, S=${match[2]}`);
      const h = Math.round(parseInt(match[1], 10) * 255 / 360);
      const s = Math.round(parseInt(match[2], 10) * 255 / 100);

      // CRITICAL: Pack the integer so the C code can read it correctly.
      // To make value_data[0] = h and value_data[1] = s, we must pack it as:
      // value = (s << 8) | h;
      // Low byte (value & 0xff) will be 'h'.
      // Second byte ((value >> 8) & 0xff) will be 's'.
      const packedValue = (s << 8) | h;

      props.onChange(packedValue);
    } else {
      console.error("Could not parse HSV string:", color.hsv);
    }
  };

  /**
   * "Unpacking" Logic: This prepares the value for the MuiColorInput.
   * It takes the packed integer and correctly extracts H (from the low byte)
   * and S (from the high byte).
   */
  const unpackHsvToString = (packedValue: number): string => {
    // Extract Hue from the LOW byte
    const hByte = packedValue & 0xff;
    // Extract Saturation from the HIGH byte
    const sByte = (packedValue >> 8) & 0xff;

    // Scale the byte values (0-255) back to the standard HSV ranges (0-360, 0-100)
    const h = Math.round(hByte * 360 / 255);
    const s = Math.round(sByte * 100 / 255);
    const v = 100; // Use a fixed value for brightness

    // Reconstruct the string for the color picker
    return `hsv(${h}, ${s}%, ${v}%)`;
  };
  return (
    <>
      <Grid item xs={3}>
        <h4>{props.label}</h4>
      </Grid>
      <Grid item xs={9}>
        <FormControl fullWidth>
          <MuiColorInput
            value={unpackHsvToString(props.value)}
            onChange={handleChange}
            format="rgb"
          ></MuiColorInput>
        </FormControl>
      </Grid>
    </>
  );
}

function ViaButton(props: ButtonElement) {
  return (
    <>
      <Grid item xs={3}>
        <h4>{props.label}</h4>
      </Grid>
      <Grid item xs={9}>
        <Button
          variant="outlined"
          onClick={() => {
            props.onChange(props.options?.[0] ?? 0);
          }}
        >
          Click
        </Button>
      </Grid>
    </>
  );
}

function ViaMultipleCheckbox(props: MultipleCheckboxElement) {
  const labels = getDropDownLabels(props);
  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    props.onChange(
      typeof value === "string"
        ? (labels.find((v) => v[0] === value)?.[1] ?? 0)
        : (value as string[]).reduce(
          (p, c) => p ^ (1 << (labels.find((v) => v[0] === c)?.[1] ?? 0)),
          0,
        ),
    );
  };

  const valueToLabel = (value: string[]) => {
    return value.map((v) => labels.find((label) => v === label[0])?.[0]).join(", ");
  };

  const valueToArray = (value: number): string[] => {
    const bitsArray: number[] = [];
    for (let i = 0; i < 32; i++) {
      if (value & (1 << i)) {
        bitsArray.push(i);
      }
    }
    const arr = bitsArray.map((b) => labels.find((label) => label[1] == b)?.[0] ?? "");
    return arr;
  };

  return (
    <>
      <Grid item xs={3}>
        <h4>{props.label}</h4>
      </Grid>
      <Grid item xs={9}>
        <FormControl fullWidth>
          <Select<string[]>
            multiple
            value={valueToArray(props.value)}
            onChange={handleChange}
            renderValue={(v) => valueToLabel(v)}
          >
            {labels.map((o) => {
              return (
                <MenuItem key={`${props.label}-${o[0]}`} value={o[0]}>
                  <Checkbox checked={(props.value & (1 << o[1])) !== 0} />
                  <ListItemText primary={o[0]} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Grid>
    </>
  );
}

function MenuElement(props: MenuSectionProperties, elem: MenuElementProperties) {
  if ("type" in elem) {
    switch (elem.type) {
      case "toggle":
        return (
          <ViaToggle
            key={`${props.label}-${elem.label}`}
            {...elem}
            value={props.customValues[elem.content[0]] ?? 0}
            onChange={(value) => props.onChange(elem.content, value)}
          />
        );
      case "range":
        return (
          <ViaRange
            key={`${props.label}-${elem.label}`}
            {...elem}
            value={props.customValues[elem.content[0]] ?? 0}
            onChange={(value) => props.onChange(elem.content, value)}
          />
        );
      case "dropdown":
        return (
          <ViaDropDown
            key={`${props.label}-${elem.label}`}
            {...elem}
            value={props.customValues[elem.content[0]] ?? 0}
            onChange={(value) => props.onChange(elem.content, value)}
          />
        );
      case "color":
        return (
          <ViaColor
            key={`${props.label}-${elem.label}`}
            {...elem}
            value={props.customValues[elem.content[0]] ?? 0}
            onChange={(value) => props.onChange(elem.content, value)}
          />
        );
      case "button":
        return (
          <ViaButton
            key={`${props.label}-${elem.label}`}
            {...elem}
            value={props.customValues[elem.content[0]] ?? 0}
            onChange={(value) => props.onChange(elem.content, value)}
          />
        );
      case "multiple-checkbox":
        return (
          <ViaMultipleCheckbox
            key={`${props.label}-${elem.label}`}
            {...elem}
            value={props.customValues[elem.content[0]] ?? 0}
            onChange={(value) => props.onChange(elem.content, value)}
          />
        );
      default:
        return <></>;
    }
  }
}

function ViaMenuItem(props: MenuSectionProperties) {
  return (
    <Grid container alignItems="center" spacing={2}>
      <Grid item xs={12}></Grid>
      {props.content.flatMap((elem) => {
        if ("showIf" in elem) {
          const show = evaluate(props.customValues, elem.showIf.replace(/({|})/g, ""));
          if (show) {
            return "label" in elem
              ? MenuElement(props, elem)
              : elem.content.flatMap((elem) => MenuElement(props, elem));
          }
        } else if ("type" in elem) {
          return MenuElement(props, elem);
        }
      })}
    </Grid>
  );
}

export { ViaMenuItem };
export type { MenuItemProperties, MenuSectionProperties };
