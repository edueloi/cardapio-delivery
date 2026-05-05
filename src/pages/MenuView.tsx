import { useParams } from "react-router-dom";
import StandardMenuView from "../features/menu-view/MenuViewPage";
import TableMenuView from "../features/menu-view/TableMenuView";

export default function MenuView() {
  const { tableId } = useParams();
  
  if (tableId) {
    return <TableMenuView />;
  }
  
  return <StandardMenuView />;
}
