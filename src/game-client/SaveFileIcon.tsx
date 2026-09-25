import importIcon from "../assets/icons/menu/box-arrow-in-down.svg";
import exportIcon from "../assets/icons/menu/box-arrow-up.svg";
import trashIcon from "../assets/icons/menu/trash3.svg";

/** Original Bootstrap Icons; matches the existing settings icon source. */
export function SaveFileIcon({ direction }: { direction: "import" | "export" | "delete" }) {
  const src = direction === "delete" ? trashIcon : direction === "import" ? importIcon : exportIcon;
  return <i className="save-file-icon" aria-hidden="true" style={{ maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }} />;
}
