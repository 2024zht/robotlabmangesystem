import React, { useState, useEffect } from 'react';
import { Rule } from '../types';
import { ruleAPI } from '../services/api';
import { BookOpen, Plus, Minus } from 'lucide-react';

const Rules: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data } = await ruleAPI.getAll();
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const positiveRules = rules.filter(rule => rule.points > 0);
  const negativeRules = rules.filter(rule => rule.points < 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center space-x-3 mb-6">
          <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">积分规则</h2>
        </div>

        {/* 加分规则 */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Plus className="h-5 w-5 text-green-600" />
            <h3 className="text-lg sm:text-xl font-semibold text-green-700">加分项</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {positiveRules.map((rule) => (
              <div
                key={rule.id}
                className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{rule.name}</h4>
                  <span className="bg-green-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                    +{rule.points}
                  </span>
                </div>
                {rule.description && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-2">{rule.description}</p>
                )}
              </div>
            ))}
          </div>
          {positiveRules.length === 0 && (
            <p className="text-gray-500 text-center py-4">暂无加分规则</p>
          )}
        </div>

        {/* 扣分规则 */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Minus className="h-5 w-5 text-red-600" />
            <h3 className="text-lg sm:text-xl font-semibold text-red-700">扣分项</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {negativeRules.map((rule) => (
              <div
                key={rule.id}
                className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{rule.name}</h4>
                  <span className="bg-red-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                    {rule.points}
                  </span>
                </div>
                {rule.description && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-2">{rule.description}</p>
                )}
              </div>
            ))}
          </div>
          {negativeRules.length === 0 && (
            <p className="text-gray-500 text-center py-4">暂无扣分规则</p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>提示：</strong>积分规则由管理员制定和管理。请遵守实验室规章制度，积极参与实验室活动以获得积分。
        </p>
      </div>
    </div>
  );
};

export default Rules;

