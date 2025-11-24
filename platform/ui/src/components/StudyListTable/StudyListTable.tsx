import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import StudyListTableRow from './StudyListTableRow';
import getGridWidthClass from '../../utils/getGridWidthClass';

// 列名映射：key -> 中文标签
const getColumnLabel = (key) => {
  const labelMap = {
    caseId: 'case ID',
    patientName: 'patient name',
    mrn: 'mrn',
    createdAt: 'created at',
    studyCount: 'study count',
    actions: '',
    expandIcon: '', // 展开图标列，不需要标签
    studyIndent: '', // 缩进列，不需要标签
    studyInfo: 'study info',
    studyDate: 'study date',
    description: 'description',
    // 可以根据需要添加更多映射
  };
  // 明确检查 key 是否存在于 labelMap 中，如果存在就返回其值（即使是空字符串）
  return key in labelMap ? labelMap[key] : key;
};

const StudyListTable = ({ tableDataSource, querying }) => {
  // 从第一行数据中提取列信息来生成表头
  const getTableHeaders = () => {
    if (!tableDataSource || tableDataSource.length === 0) {
      return [];
    }

    // 获取第一行数据的列信息
    const firstRow = tableDataSource[0];
    if (!firstRow || !firstRow.row) {
      return [];
    }

    // 从第一行的 row 数组中提取列信息
    return firstRow.row.map(cell => ({
      key: cell.key,
      label: getColumnLabel(cell.key),
      gridCol: cell.gridCol,
    }));
  };

  const headers = getTableHeaders();
  const hasData = tableDataSource && tableDataSource.length > 0;

  return (
    <div className="bg-black">
      <div className="container relative m-auto">
        {/* 独立的表头行 - 结构与内层表格对齐 */}
        {hasData && headers.length > 0 && (
          <div className="sticky top-0 z-20 bg-primary-dark border-b-2 border-secondary-light">
            <div className="w-full">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {headers.map((header, index) => {
                      const isActionsColumn = header.key === 'actions';
                      const isExpandIconColumn = header.key === 'expandIcon';
                      
                      return (
                        <th
                          key={header.key || index}
                          className={classnames(
                            // actions 和 expandIcon 列使用更小的 padding
                            isActionsColumn || isExpandIconColumn ? 'px-2 py-3' : 'px-4 py-3',
                            // actions、expandIcon、studyCount 列居中，其他列左对齐
                            isActionsColumn || isExpandIconColumn || header.key === 'studyCount' 
                              ? 'text-center' 
                              : 'text-left',
                            'text-xl font-extrabold text-primary-light',
                            getGridWidthClass(header.gridCol) || ''
                          )}
                        >
                          {index === 0 ? (
                            <div className={classnames('flex', {
                              'justify-center': isActionsColumn || isExpandIconColumn || header.key === 'studyCount',
                            })}>
                              <div className="w-6 mr-4"></div>
                              <span>{header.label}</span>
                            </div>
                          ) : (
                            <span>{header.label}</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
              </table>
            </div>
          </div>
        )}
        {/* 数据表格 */}
        <table className="w-full text-white">
          <tbody
            data-cy="study-list-results"
            data-querying={querying}
          >
            {tableDataSource.map((tableData, i) => {
              return (
                <StudyListTableRow
                  tableData={tableData}
                  key={i}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

StudyListTable.propTypes = {
  tableDataSource: PropTypes.arrayOf(
    PropTypes.shape({
      row: PropTypes.array.isRequired,
      expandedContent: PropTypes.node,
      querying: PropTypes.bool,
      onClickRow: PropTypes.func.isRequired,
      isExpanded: PropTypes.bool.isRequired,
    })
  ),
  querying: PropTypes.bool,
};

export default StudyListTable;
